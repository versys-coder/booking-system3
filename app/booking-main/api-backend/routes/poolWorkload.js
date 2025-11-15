require('dotenv').config();
const express = require('express');
const router = express.Router();
const Papa = require('papaparse');
const { createClient } = require('@clickhouse/client');

/**
 * Конфигурация ClickHouse
 * CLICKHOUSE_DB1 = workload (таблица workload_tren_comm)
 */
const clickhouseWorkload = createClient({
  url: `https://${process.env.CLICKHOUSE_HOST}:${process.env.CLICKHOUSE_PORT}`,
  username: process.env.CLICKHOUSE_USER,
  password: process.env.CLICKHOUSE_PASSWORD,
  database: process.env.CLICKHOUSE_DB1, // workload
});

// ==== Константы бассейна ====
const TOTAL_LANES = 10;
const LANE_CAPACITY = 12;
const TOTAL_PLACES = TOTAL_LANES * LANE_CAPACITY;

// ==== Источник занятий (Google Sheets) ====
const GOOGLE_SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQDetwGFMs93GDroCQ7xI1PCEv8S68BOSLlpoI6wx9Rc1GyDgyVqlnDRPQmk_VrYqKU2RZMwbV5CLOX/pub?output=csv';

// ==== Таймзона Екатеринбурга ====
// Смещение относительно UTC (часов). Можно переопределить через ENV.
const EKB_TZ_OFFSET = Number(process.env.EKB_TZ_OFFSET || 5);

// ==== Вспомогательные функции ====
function getEkaterinburgDateHour() {
  const nowUtc = new Date();
  const ekbMs = nowUtc.getTime() + EKB_TZ_OFFSET * 3600 * 1000;
  const ekbDateObj = new Date(ekbMs);
  const date = ekbDateObj.toISOString().slice(0, 10); // YYYY-MM-DD
  const hour = ekbDateObj.getUTCHours();
  return { date, hour, ekbDateObj };
}

function getDateArray(start, end) {
  const arr = [];
  let cur = new Date(start);
  while (cur <= end) {
    arr.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return arr;
}

// Перерыв: Пн–Пт в 12
function isBreakHour(date, hour) {
  if (hour !== 12) return false;
  const day = new Date(date).getDay(); // 0-вс
  return day >= 1 && day <= 5;
}

// Подсчёт свободных дорожек из расписания
function calcWorkload(rows, date, hour) {
  const busyLanes = new Set();
  for (const r of rows) {
    if (!r.location || !r.start_time || !r.end_time) continue;
    const start = new Date(r.start_time);
    const end = new Date(r.end_time);
    const sameDate = start.toISOString().slice(0, 10) === date;
    const inHour = start.getHours() <= hour && end.getHours() > hour;
    if (sameDate && inHour) {
      const laneMatch = r.location.match(/(\d+)\s*дорожк/);
      if (laneMatch) busyLanes.add(Number(laneMatch[1]));
    }
  }
  const freeLanes = Math.max(0, TOTAL_LANES - busyLanes.size);
  return {
    freeLanes,
    busyLanes: busyLanes.size,
    totalLanes: TOTAL_LANES,
    freePlaces: freeLanes * LANE_CAPACITY,
    totalPlaces: TOTAL_PLACES,
  };
}

/**
 * Получение текущего значения людей:
 *  - exact (anyLast(current) за (date,hour))
 *  - если пусто -> previousHour
 *  - если и там пусто -> none
 *
 * Если таблица ReplacingMergeTree с версионным столбцом, можно заменить anyLast на:
 *   argMax(current, <version_column>)
 */
async function fetchCurrent(nowDate, nowHour) {
  const exactSql = `
    SELECT anyLast(current) AS current
    FROM workload_tren_comm
    WHERE date='${nowDate}' AND hour=${nowHour}
  `;
  const prevSql = nowHour > 0 ? `
    SELECT anyLast(current) AS current
    FROM workload_tren_comm
    WHERE date='${nowDate}' AND hour=${nowHour - 1}
  ` : null;

  try {
    const exactRes = await clickhouseWorkload.query({ query: exactSql, format: 'JSON' }).then(r => r.json());
    const exactVal = exactRes.data?.[0]?.current;
    if (exactVal !== null && exactVal !== undefined) {
      return { current: exactVal, source: 'exact', raw: { exactSql } };
    }

    if (prevSql) {
      const prevRes = await clickhouseWorkload.query({ query: prevSql, format: 'JSON' }).then(r => r.json());
      const prevVal = prevRes.data?.[0]?.current;
      if (prevVal !== null && prevVal !== undefined) {
        return { current: prevVal, source: 'previousHour', raw: { exactSql, prevSql } };
      }
    }

    return { current: null, source: 'none', raw: { exactSql, prevSql } };
  } catch (e) {
    console.error('fetchCurrent error:', e);
    return { current: null, source: 'error', error: String(e) };
  }
}

/**
 * Диагностика (для ?diag=1):
 *  - todayHours: сводка по часам (anyLast)
 *  - tzNow: «пересчитанное» локальное время экб
 *  - lag: если текущий час < макс. час в todayHours -> 0 (ок) иначе считаем разрыв
 */
async function diagnostics(nowDate, nowHour) {
  try {
    const todaySql = `
      SELECT hour, anyLast(current) AS current
      FROM workload_tren_comm
      WHERE date='${nowDate}'
      GROUP BY hour
      ORDER BY hour
    `;
    const todayRes = await clickhouseWorkload.query({ query: todaySql, format: 'JSON' }).then(r => r.json());
    const todayHours = todayRes.data || [];
    const maxHour = todayHours.length ? Math.max(...todayHours.map(r => r.hour)) : null;
    let lag = null;
    if (maxHour !== null) {
      lag = nowHour - maxHour;
    }
    return { todayHours, lag, tzOffset: EKB_TZ_OFFSET, nowHour };
  } catch (e) {
    return { error: String(e) };
  }
}

/**
 * Основной endpoint
 * Параметры:
 *  - start_date / end_date (YYYY-MM-DD) (по умолчанию неделя вперёд от сегодня)
 *  - start_hour / end_hour (по умолчанию 7..21)
 *  - diag=1 для диагностики
 */
router.get('/', async (req, res) => {
  const { start_date, end_date, start_hour, end_hour, diag } = req.query;

  const { date: nowDate, hour: nowHour } = getEkaterinburgDateHour();

  let start = start_date ? new Date(start_date) : new Date(nowDate);
  let end = end_date ? new Date(end_date) : new Date(nowDate);
  if (!end_date) {
    end.setDate(end.getDate() + 6); // неделя вперёд
  }

  const fromHour = start_hour ? parseInt(start_hour, 10) : 7;
  const toHour = end_hour ? parseInt(end_hour, 10) : 21;

  const dates = getDateArray(start, end);
  const hourArr = [];
  for (let h = fromHour; h <= toHour; h++) hourArr.push(h);

  try {
    // Параллельно:
    const [{ current, source, raw }, csvText, diagData] = await Promise.all([
      fetchCurrent(nowDate, nowHour),
      fetch(GOOGLE_SHEET_CSV_URL).then(r => r.text()),
      diag ? diagnostics(nowDate, nowHour) : Promise.resolve(null),
    ]);

    Papa.parse(csvText, {
      header: true,
      complete: (parsed) => {
        const rows = parsed.data;
        const slots = [];

        for (const d of dates) {
            for (const h of hourArr) {
              const breakHour = isBreakHour(d, h);
              const w = calcWorkload(rows, d, h);
              if (breakHour) {
                w.freeLanes = 0;
                w.freePlaces = 0;
              }

              let slotCurrent = null;
              let freePlaces = w.freePlaces;

              if (d === nowDate && h === nowHour && current !== null) {
                slotCurrent = current;
                freePlaces = Math.max(0, TOTAL_PLACES - current);
              }
              // Если хочешь показывать число ещё и на предыдущем часу когда source=previousHour - раскомментируй:
              // else if (d === nowDate && h === nowHour - 1 && source === 'previousHour' && current !== null) {
              //   slotCurrent = current;
              // }

              slots.push({
                date: d,
                hour: h,
                current: slotCurrent,
                freeLanes: w.freeLanes,
                busyLanes: w.busyLanes,
                totalLanes: w.totalLanes,
                freePlaces,
                totalPlaces: w.totalPlaces,
                isBreak: breakHour,
              });
            }
        }

        res.json({
          currentNow: {
            date: nowDate,
            hour: nowHour,
            current,
            source,
          },
          meta: {
            serverNowDate: nowDate,
            serverNowHour: nowHour,
            tzOffset: EKB_TZ_OFFSET,
          },
          slots,
          diagnostics: diag ? {
            ...diagData,
            rawCurrent: raw,
          } : undefined,
        });
      },
    });
  } catch (e) {
    console.error('pool-workload error:', e);
    res.status(500).json({ error: 'internal_error', details: String(e) });
  }
});

module.exports = router;