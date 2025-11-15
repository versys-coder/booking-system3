import React, { useEffect, useMemo, useRef, useState } from "react";

// Константы (как в PoolWorkload3)
const TOTAL_LANES = 10;
const LANE_CAPACITY = 12;
const TOTAL_PLACES = TOTAL_LANES * LANE_CAPACITY;
const HOUR_START = 7;
const HOUR_END = 21;

interface Slot {
  date: string;
  hour: number;
  freePlaces: number;
  freeLanes?: number;
  isBreak: boolean;
}
interface ApiResponse {
  slots: Slot[];
}

function formatDateShortRu(iso: string) {
  const [, m, d] = iso.split("-");
  const months = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
  return `${+d} ${months[+m - 1]}`;
}
function weekdayRu(iso: string) {
  const names = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
  const wd = new Date(iso).getDay(); // 0..6 (0 - воскресенье)
  return names[wd === 0 ? 6 : wd - 1];
}
function isBreakHour(dateIso: string, hour: number) {
  const day = new Date(dateIso).getDay(); // 0=Вс..6=Сб
  return day >= 1 && day <= 5 && hour === 12;
}
function colorForFreePlaces(freePlaces: number) {
  // как в оригинале: плавный градиент от светло-серого к насыщенному синему
  const ratio = Math.max(0, Math.min(1, freePlaces / TOTAL_PLACES));
  const c1 = [230, 234, 241]; // мало мест — светло-серый
  const c2 = [35, 105, 214];  // много мест — насыщенный синий
  const r = Math.round(c1[0] + (c2[0] - c1[0]) * ratio);
  const g = Math.round(c1[1] + (c2[1] - c1[1]) * ratio);
  const b = Math.round(c1[2] + (c2[2] - c1[2]) * ratio);
  return `rgb(${r},${g},${b})`;
}

export default function PoolWorkload3Clone() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const panelRef = useRef<HTMLDivElement | null>(null);

  const hours = useMemo(
    () => Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i),
    []
  );

  async function fetchData() {
    try {
      setLoading(true);
      const res = await fetch("/api/pool-workload?start_hour=7&end_hour=21");
      if (!res.ok) throw new Error(res.statusText);
      const data: ApiResponse = await res.json();
      setSlots(data.slots || []);
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, []);

  const dates = useMemo(() => {
    const s = new Set<string>();
    for (const sl of slots) s.add(sl.date);
    return Array.from(s).sort();
  }, [slots]);

  const slotMap = useMemo(() => {
    const m: Record<string, Record<number, Slot>> = {};
    for (const sl of slots) {
      (m[sl.date] ||= {})[sl.hour] = sl;
    }
    return m;
  }, [slots]);

  return (
    <div className="booking-variant booking-variant1-row">
      <div className="booking-variant1-chart">
        <div className="heatmap-root--professional">
          <div className="heatmap-panel" ref={panelRef}>
            {/* Заголовок/описание можно добавить при желании */}
            <div className="heatmap-grid-wrapper">
              {/* Шапка часов */}
              <div className="heatmap-hours-row">
                <div className="heatmap-date-col-spacer" />
                {hours.map((h) => (
                  <div key={h} className="heatmap-hour-label">
                    {String(h).padStart(2, "0")}:00
                  </div>
                ))}
              </div>

              {/* Ряды по датам */}
              <div className="heatmap-grid">
                {dates.map((dateIso) => (
                  <div key={dateIso} className="heatmap-row">
                    <div className="heatmap-date-col">
                      <div className="heatmap-date-main">{formatDateShortRu(dateIso)}</div>
                      <div className="heatmap-date-sub">{weekdayRu(dateIso)}</div>
                    </div>
                    <div className="heatmap-cells">
                      {hours.map((h) => {
                        const sl = slotMap[dateIso]?.[h];
                        const br = isBreakHour(dateIso, h) || !!sl?.isBreak;
                        const freePlaces = br
                          ? 0
                          : (sl?.freePlaces ??
                              (typeof sl?.freeLanes === "number" ? sl.freeLanes * LANE_CAPACITY : 0));

                        if (br) {
                          return (
                            <div key={`${dateIso}_${h}`} className="heatmap-cell heatmap-cell--break" title="ПЕРЕРЫВ">
                              П
                            </div>
                          );
                        }

                        return (
                          <div
                            key={`${dateIso}_${h}`}
                            className="heatmap-cell"
                            style={{ background: colorForFreePlaces(freePlaces) }}
                            title={`${freePlaces} мест`}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {loading && (
              <div style={{ marginTop: 8, color: "#185a90", fontWeight: 700 }}>Загрузка…</div>
            )}
            {error && (
              <div style={{ marginTop: 8, color: "#b00020", fontWeight: 700 }}>Ошибка: {error}</div>
            )}
          </div>
        </div>
      </div>

      {/* Правая колонка — заглушка */}
      <div className="booking-variant1-side">
        <h3 style={{ color: "#185a90", fontWeight: 900, margin: "0 0 12px" }}>
          Бронирование
        </h3>
        <p style={{ color: "#406483", marginTop: 0 }}>
          Здесь будет форма бронирования. Пока заглушка.
        </p>
        <div
          style={{
            marginTop: 12,
            padding: "14px 12px",
            background: "#f5f8fb",
            borderRadius: 12,
            color: "#185a90",
            fontWeight: 700,
            width: "100%",
          }}
        >
          Выберите удобное время слева.
        </div>
      </div>
    </div>
  );
}