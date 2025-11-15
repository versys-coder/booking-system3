import React, { useEffect, useState } from "react";
import Papa from "papaparse";

// --- Фиксированные параметры ---
const LANE_CAPACITY = 12;
const TOTAL_LANES = 10;
const HOUR_START = 7;
const HOUR_END = 21;
const GOOGLE_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQDetwGFMs93GDroCQ7xI1PCEv8S68BOSLlpoI6wx9Rc1GyDgyVqlnDRPQmk_VrYqKU2RZMwbV5CLOX/pub?output=csv";

// --- УТИЛИТЫ ---
function formatDateShortRu(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${+d} ${["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"][+m - 1]}`;
}
function isBreakHour(dateIso: string, hour: number) {
  const day = new Date(dateIso).getDay();
  return day >= 1 && day <= 5 && hour === 12;
}
function getHourStrings() {
  const arr: string[] = [];
  for (let h = HOUR_START; h <= HOUR_END; h++) arr.push(h.toString().padStart(2, "0") + ":00");
  return arr;
}
function makeFreeMatrix(rows: any[], allDates: string[]) {
  const busy: Record<string, Record<number, Set<number>>> = {};
  rows.forEach((r) => {
    if (!r.location || !r.start_time || !r.end_time) return;
    const laneMatch = r.location.match(/(\d+)\s*дорожк/);
    const laneNum = laneMatch ? Number(laneMatch[1]) : null;
    if (laneNum === null) return;
    const start = new Date(r.start_time);
    const end = new Date(r.end_time);
    const dateKey = start.toISOString().slice(0, 10);
    for (let h = start.getHours(); h < end.getHours(); h++) {
      if (!busy[dateKey]) busy[dateKey] = {};
      if (!busy[dateKey][h]) busy[dateKey][h] = new Set();
      busy[dateKey][h].add(laneNum);
    }
  });
  const free: Record<string, Record<number, number>> = {};
  for (const date of allDates) {
    free[date] = {};
    for (let h = HOUR_START; h <= HOUR_END; h++) {
      free[date][h] = isBreakHour(date, h)
        ? 0
        : Math.max(
            0,
            Math.min(TOTAL_LANES, TOTAL_LANES - (busy[date]?.[h]?.size || 0))
          );
    }
  }
  return { free, dates: allDates };
}

// --- Колесики + свободные дорожки + свободно мест + кнопка ---
function WheelPickers({
  weekDates,
  freeMatrix,
  laneCapacity = LANE_CAPACITY,
  onBook,
}: {
  weekDates: string[];
  freeMatrix: Record<string, Record<number, number>>;
  laneCapacity?: number;
  onBook?: (date: string, hour: number) => void;
}) {
  const hours = getHourStrings();
  const [dateIdx, setDateIdx] = useState(0);
  const [timeIdx, setTimeIdx] = useState(0);

  const selectedDateIso = weekDates[dateIdx];
  const selectedHour = parseInt(hours[timeIdx]);
  const isBreak = isBreakHour(selectedDateIso, selectedHour);
  let freeLanes = 0;
  if (!isBreak) {
    freeLanes =
      freeMatrix[selectedDateIso]?.[selectedHour] !== undefined
        ? freeMatrix[selectedDateIso][selectedHour]
        : 0;
  }
  const freePlaces = isBreak ? 0 : freeLanes * laneCapacity;

  return (
    <>
      <style>
        {`
.wheel-pickers-container {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  gap: 50px;
  margin: 52px auto 0 auto;
  background: none;
}
.picker-col {
  width: 270px;
  min-width: 270px;
  text-align: center;
  font-family: inherit;
}
.wheel-card {
  background: #fff;
  border-radius: 28px;
  box-shadow: 0 2.5px 18px #0001;
  padding: 0;
  margin: 0;
  position: relative;
  height: 180px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}
.wheel {
  position: absolute;
  width: 100%;
  left: 0; top: 0;
  transition: transform 0.3s cubic-bezier(.44,.13,.62,1.08);
}
.item {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30px;
  user-select: none;
  transition: font-weight 0.2s, font-size 0.2s;
  color: #185a90;
}
.item.selected {
  font-size: 38px;
  font-weight: bold;
  background: #e4f8ff;
  border-radius: 20px;
}
.free-col-box {
  background: #fff;
  border-radius: 22px;
  box-shadow: 0 2px 10px #0001;
  min-height: 180px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.free-label {
  color: #185a90;
  font-size: 1.35em;
  margin: 24px 0 0 0;
  font-weight: 700;
}
.free-count {
  font-size: 2.95em;
  font-weight: 900;
  margin: 24px 0 0 0;
  color: #185a90;
}
.booking-col-box {
  background: #fff;
  border-radius: 22px;
  box-shadow: 0 2px 10px #0001;
  min-height: 180px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 170px;
  margin-left: 32px;
}
.booking-btn {
  margin-top: 26px;
  padding: 22px 44px;
  background: #54a1d7;
  border: none;
  border-radius: 18px;
  font-size: 1.35em;
  font-weight: 900;
  color: #fff;
  cursor: pointer;
  box-shadow: 0 2px 10px #aadfff;
}
        `}
      </style>
      <div className="wheel-pickers-container">
        {/* Дата */}
        <div className="picker-col">
          <div className="wheel-card">
            <div
              className="wheel"
              style={{
                transform: `translateY(${-dateIdx * 60 + 60}px)`,
              }}
            >
              {weekDates.map((item, idx) => (
                <div
                  key={item}
                  className={`item${idx === dateIdx ? " selected" : ""}`}
                  style={{
                    fontWeight: idx === dateIdx ? 900 : 700,
                    color: "#185a90",
                  }}
                  onClick={() => setDateIdx(idx)}
                >
                  {formatDateShortRu(item)}
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Время */}
        <div className="picker-col">
          <div className="wheel-card">
            <div
              className="wheel"
              style={{
                transform: `translateY(${-timeIdx * 60 + 60}px)`,
              }}
            >
              {hours.map((item, idx) => (
                <div
                  key={item}
                  className={`item${idx === timeIdx ? " selected" : ""}`}
                  style={{
                    fontWeight: idx === timeIdx ? 900 : 700,
                    color: "#185a90",
                  }}
                  onClick={() => setTimeIdx(idx)}
                >
                  {isBreakHour(selectedDateIso, parseInt(item))
                    ? "ПЕРЕРЫВ"
                    : item}
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Дорожки */}
        <div className="picker-col">
          <div className="free-col-box" style={{ minHeight: 180 }}>
            {isBreak ? (
              <div
                className="free-label"
                style={{
                  color: "#185a90",
                  fontWeight: 900,
                  marginTop: 44,
                  fontSize: 30,
                }}
              >
                ПЕРЕРЫВ
              </div>
            ) : (
              <>
                <div className="free-label">Свободных дорожек:</div>
                <div className="free-count">{freeLanes}</div>
              </>
            )}
          </div>
        </div>
        {/* Места + кнопка */}
        <div className="booking-col-box">
          <div className="free-label" style={{ marginTop: 32 }}>
            Свободно мест:
          </div>
          <div className="free-count" style={{ marginTop: 32 }}>
            {isBreak ? "—" : freePlaces}
          </div>
          <button
            className="booking-btn"
            disabled={isBreak}
            onClick={() => onBook && onBook(selectedDateIso, selectedHour)}
          >
            Забронировать
          </button>
        </div>
      </div>
    </>
  );
}

const BookingVariant4: React.FC = () => {
  const [freeMatrix, setFreeMatrix] = useState<Record<string, Record<number, number>>>({});
  const [weekDates, setWeekDates] = useState<string[]>([]);
  const [selected, setSelected] = useState<{ date: string; hour: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    Papa.parse(GOOGLE_SHEET_CSV_URL, {
      download: true,
      header: true,
      complete: (results) => {
        const data = results.data;
        const today = new Date();
        const week: string[] = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(today);
          d.setDate(today.getDate() + i);
          week.push(d.toISOString().slice(0, 10));
        }
        setWeekDates(week);
        const { free } = makeFreeMatrix(data, week);
        setFreeMatrix(free);
        setIsLoading(false);
      },
    });
  }, []);

  return (
    <div style={{
      maxWidth: 900,
      margin: "0 auto",
      marginTop: 40,
      background: "#f5f6f8",
      fontFamily: '"San Francisco", "SF Pro Display", Arial, sans-serif',
      minHeight: "100vh",
      paddingBottom: 80,
    }}>
      {isLoading ? (
        <div>Загрузка...</div>
      ) : (
        <WheelPickers
          weekDates={weekDates}
          freeMatrix={freeMatrix}
          laneCapacity={LANE_CAPACITY}
          onBook={(date: string, hour: number) => setSelected({ date, hour })}
        />
      )}
      <div style={{ textAlign: "center", marginTop: 32 }}>
        {selected
          ? (
            <div>
              <b>Выбрано:</b> {formatDateShortRu(selected.date)} {selected.hour}:00
            </div>
          )
          : <div>Выберите дату и время в колесах выше</div>
        }
      </div>
    </div>
  );
};

export default BookingVariant4;