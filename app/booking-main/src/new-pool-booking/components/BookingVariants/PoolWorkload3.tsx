import React, { useEffect, useMemo, useRef, useState } from "react";
import "./Heatmap.css";

const TOTAL_LANES = 10;
const LANE_CAPACITY = 12;
const TOTAL_PLACES = TOTAL_LANES * LANE_CAPACITY;
const HOUR_START = 7;
const HOUR_END = 21;

// Задаём константы для отступов между клетками
export const HEATMAP_CELL_GAP_X = 5; // горизонтальный gap, px
export const HEATMAP_CELL_GAP_Y = 3; // вертикальный gap, px

interface Slot {
  date: string;
  hour: number;
  freePlaces: number;
  isBreak: boolean;
}

interface ApiResponse {
  slots: Slot[];
}

type PoolWorkload3Props = {
  onBook?: (date: string, hour: number) => void;
};

function colorForFreePlaces(freePlaces: number) {
  // Градиент: от светло-серого (мало мест) к насыщенному синему (много)
  // 0 мест: #e6eaf1, макс: #2369d6
  const ratio = Math.max(0, Math.min(1, freePlaces / TOTAL_PLACES));
  // Цвета: [R,G,B]
  const c1 = [230, 234, 241]; // мало мест — светло-серый
  const c2 = [35, 105, 214]; // много мест — насыщенный синий
  const r = Math.round(c1[0] + (c2[0] - c1[0]) * ratio);
  const g = Math.round(c1[1] + (c2[1] - c1[1]) * ratio);
  const b = Math.round(c1[2] + (c2[2] - c1[2]) * ratio);
  return `rgb(${r},${g},${b})`;
}

function formatDateShortRu(iso: string) {
  const [, m, d] = iso.split("-");
  const months = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
  return `${+d} ${months[+m - 1]}`;
}
function weekdayRu(iso: string) {
  const names = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
  return names[new Date(iso).getDay() === 0 ? 6 : new Date(iso).getDay() - 1];
}

const PoolWorkload3: React.FC<PoolWorkload3Props> = ({ onBook }) => {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<{ date: string; hour: number } | null>(null);

  const panelRef = useRef<HTMLDivElement | null>(null);

  const hours = useMemo(
    () => Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i),
    []
  );

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/pool-workload?start_hour=7&end_hour=21");
      if (!res.ok) throw new Error(res.statusText);
      const data: ApiResponse = await res.json();
      setSlots(data.slots || []);
      setError(null);
    } catch (e: any) {
      setError(e.message || "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const dates = useMemo(() => {
    const s = new Set<string>();
    for (const sl of slots) s.add(sl.date);
    return Array.from(s).sort();
  }, [slots]);

  const slotMap = useMemo(() => {
    const m: Record<string, Record<number, Slot>> = {};
    for (const sl of slots) {
      if (!m[sl.date]) m[sl.date] = {};
      m[sl.date][sl.hour] = sl;
    }
    return m;
  }, [slots]);

  function handleCellClick(date: string, hour: number) {
    const sl = slotMap[date]?.[hour];
    if (!sl || sl.isBreak) return;
    setSelected({ date, hour });
    if (onBook) onBook(date, hour);
  }

  return (
    <div className="heatmap-root heatmap-root--professional">
      <div className="heatmap-panel" ref={panelRef}>
        <div className="heatmap-header-row" />
        <div className="heatmap-grid-wrapper">
          <table
            className="heatmap-grid heatmap-grid--professional"
            role="grid"
            aria-label="Тепловая карта свободных мест"
            style={{
              borderSpacing: `${HEATMAP_CELL_GAP_X}px ${HEATMAP_CELL_GAP_Y}px`
            }}
          >
            <thead>
              <tr>
                <th className="heatmap-grid-th-day">День</th>
                {hours.map((h) => (
                  <th key={h} className="heatmap-grid-th-hour">{h}:00</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dates.map((date) => (
                <tr key={date}>
                  <th
                    className="heatmap-grid-th-date"
                    title={formatDateShortRu(date)}
                    scope="row"
                  >
                    <div className="heatmap-grid-date">
                      <div className="heatmap-grid-date-dow">{weekdayRu(date)}</div>
                      <div className="heatmap-grid-date-short">{formatDateShortRu(date)}</div>
                    </div>
                  </th>
                  {hours.map((h) => {
                    const sl = slotMap[date]?.[h];
                    const isSel = selected && selected.date === date && selected.hour === h;
                    const isBreak = sl?.isBreak;
                    const freePlaces = sl?.freePlaces ?? 0;
                    const bg = !sl ? "#e6eaf1" : isBreak ? "#f2f4f6" : colorForFreePlaces(freePlaces);
                    return (
                      <td key={h}>
                        <button
                          type="button"
                          className={
                            "heatmap-cell heatmap-cell--professional" +
                            (isSel ? " selected" : "") +
                            (isBreak ? " break" : "")
                          }
                          onClick={() => handleCellClick(date, h)}
                          disabled={!sl || isBreak}
                          aria-pressed={!!isSel}
                          title={isBreak ? "Перерыв" : (sl ? `${freePlaces} свободно` : "Нет данных")}
                          style={{
                            background: isBreak ? undefined : bg,
                            color: isBreak
                              ? "#375a78"
                              : freePlaces > (TOTAL_PLACES / 2)
                                ? "#fff"
                                : "#1a2f42"
                          }}
                        >
                          {isBreak ? "ПЕРЕРЫВ" : (sl ? String(freePlaces) : "—")}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {loading && (
        <div className="pool-loading-overlay">
          <div className="pool-spinner" />
          <p>Загрузка...</p>
        </div>
      )}
      {error && <div className="pool-error">Ошибка: {error}</div>}
    </div>
  );
};

export default PoolWorkload3;