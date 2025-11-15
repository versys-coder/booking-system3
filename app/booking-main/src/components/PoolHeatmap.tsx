import React, { useEffect, useMemo, useRef, useState } from "react";

const TOTAL_LANES = 10;
const LANE_CAPACITY = 12;
const TOTAL_PLACES = TOTAL_LANES * LANE_CAPACITY;
const HOUR_START = 7;
const HOUR_END = 21;

interface Slot {
  date: string;
  hour: number;
  current: number | null;
  freeLanes: number;
  busyLanes: number;
  totalLanes: number;
  freePlaces: number;
  totalPlaces: number;
  isBreak: boolean;
}
interface CurrentNow {
  date: string;
  hour: number;
  current: number | null;
  source: string;
}
interface ApiResponse {
  currentNow: CurrentNow;
  meta: { serverNowDate: string; serverNowHour: number; tzOffset: number };
  slots: Slot[];
}
interface PopupState {
  x: number;
  y: number;
  date: string;
  hour: number;
  freePlaces: number;
  freeLanes: number;
  isBreak: boolean;
  current?: number | null;
  source?: string;
}

/* Цвет по числу свободных мест: плавный фиолетовый → сине‑голубой по количеству свободных мест */
function colorForFreePlaces(freePlaces: number) {
  const ratio = Math.max(0, Math.min(1, freePlaces / TOTAL_PLACES));
  // Градиент ключевых точек
  const stops = [
    { pos: 0,   c: [109, 31, 178] },  // #6d1fb2 (мало)
    { pos: 0.25,c: [138, 65, 255] },  // #8a41ff
    { pos: 0.50,c: [129, 96, 255] },  // #8160ff
    { pos: 0.75,c: [102,123,255] },   // #667bff
    { pos: 1,   c: [60, 174,255] },   // #3caeff (много)
  ];
  let i=0;
  for (; i<stops.length-1; i++) {
    if (ratio <= stops[i+1].pos) break;
  }
  const s1 = stops[i];
  const s2 = stops[Math.min(i+1, stops.length-1)];
  const span = s2.pos - s1.pos || 1;
  const t = (ratio - s1.pos) / span;
  const r = Math.round(s1.c[0] + (s2.c[0] - s1.c[0]) * t);
  const g = Math.round(s1.c[1] + (s2.c[1] - s1.c[1]) * t);
  const b = Math.round(s1.c[2] + (s2.c[2] - s1.c[2]) * t);
  return `rgb(${r},${g},${b})`;
}

function formatDateShortRu(iso: string) {
  const [, m, d] = iso.split("-");
  const months = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
  return `${+d} ${months[+m - 1]}`;
}
function weekdayRu(iso: string) {
  const names = ["Вс","Пн","Вт","Ср","Чт","Пт","Сб"];
  return names[new Date(iso).getDay()];
}

function adjustPopupPosition(
  x: number,
  y: number,
  panel: HTMLElement | null,
  popupWidth: number,
  popupHeight: number
) {
  if (!panel) return { x, y };
  const rect = panel.getBoundingClientRect();
  const margin = 14;
  let nx = x;
  let ny = y;
  if (nx + popupWidth > rect.left + rect.width)
    nx = rect.left + rect.width - popupWidth - margin;
  if (ny + popupHeight > rect.top + rect.height)
    ny = rect.top + rect.height - popupHeight - margin;
  if (nx < rect.left + margin) nx = rect.left + margin;
  if (ny < rect.top + margin) ny = rect.top + margin;
  return { x: nx, y: ny };
}

const PoolHeatmap: React.FC = () => {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [currentNow, setCurrentNow] = useState<CurrentNow | null>(null);
  const [meta, setMeta] = useState<ApiResponse["meta"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<{ date: string; hour: number } | null>(null);
  const [popup, setPopup] = useState<PopupState | null>(null);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);

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
      setCurrentNow(data.currentNow);
      setMeta(data.meta);
      setError(null);
    } catch (e: any) {
      setError(e.message || "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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

  useEffect(() => {
    if (currentNow) {
      setSelected({ date: currentNow.date, hour: currentNow.hour });
    }
  }, [currentNow?.date, currentNow?.hour]);

  function handleCellClick(date: string, hour: number) {
    const sl = slotMap[date]?.[hour];
    if (!sl || sl.isBreak) return;
    setSelected({ date, hour });
  }

  function handleMouseEnterCell(
    e: React.MouseEvent,
    date: string,
    hour: number
  ) {
    const sl = slotMap[date]?.[hour];
    if (!sl) return;
    const isBreak = sl.isBreak;
    const panel = panelRef.current;
    const rawX = e.clientX + 14;
    const rawY = e.clientY + 14;

    const current =
      currentNow &&
      currentNow.date === date &&
      currentNow.hour === hour
        ? currentNow.current
        : sl.current;
    const source =
      currentNow &&
      currentNow.date === date &&
      currentNow.hour === hour
        ? currentNow.source
        : undefined;

    const popupBase: PopupState = {
      x: rawX,
      y: rawY,
      date,
      hour,
      freePlaces: sl.freePlaces,
      freeLanes: sl.freeLanes,
      isBreak,
      current,
      source
    };
    setPopup(popupBase);

    // После рендера скорректируем позицию
    requestAnimationFrame(() => {
      if (popupRef.current) {
        const { x, y } = adjustPopupPosition(
          popupBase.x,
          popupBase.y,
          panel,
          popupRef.current.offsetWidth,
          popupRef.current.offsetHeight
        );
        setPopup({ ...popupBase, x, y });
      }
    });
  }

  function handleMouseLeaveCell() {
    setPopup(null);
  }

  function sourceNote(src?: string) {
    if (!src) return "";
    if (src === "previousHour") return "пред. час";
    if (src === "none") return "нет данных";
    return src;
  }

  return (
    <div className="pool-heatmap-container">
      <div className="pool-current-card" style={{ maxWidth: 860 }}>
        <div className="pool-current-card-title" style={{ fontSize: 40 }}>
          Сейчас в тренировочном бассейне:&nbsp;
          <span style={{ fontWeight: 900 }}>
            {currentNow?.current ?? "—"}
          </span>
          <br />
          <span style={{ display: "inline-block", marginTop: 30 }}>
            Свободно мест:&nbsp;
            <span style={{ fontWeight: 900 }}>
              {currentNow?.current == null
                ? "—"
                : Math.max(0, TOTAL_PLACES - currentNow.current)}
            </span>
            {currentNow?.source && currentNow.source !== "exact" && (
              <span
                style={{
                  display: "block",
                  fontSize: 16,
                  fontWeight: 600,
                  color: "#1b6aa5",
                  marginTop: 20,
                  letterSpacing: ".02em",
                }}
              >
                источник: {sourceNote(currentNow.source)}
              </span>
            )}
          </span>
          <div>
            <button
              className="refresh-btn"
              onClick={fetchData}
              disabled={loading}
            >
              {loading ? "..." : "Обновить"}
            </button>
          </div>
        </div>
      </div>

      <div className="heatmap-panel" ref={panelRef}>
        <h2 className="heatmap-title">Теплокарта свободных мест</h2>

        <div className="heatmap-grid-wrapper">
          <table className="heatmap-grid">
            <thead>
              <tr>
                <th
                  style={{
                    position: "sticky",
                    left: 0,
                    zIndex: 3,
                    background: "#ffffff",
                  }}
                >
                  День
                </th>
                {hours.map((h) => (
                  <th key={h}>{h}:00</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dates.map((date) => (
                <tr key={date}>
                  <th
                    style={{
                      position: "sticky",
                      left: 0,
                      zIndex: 3,
                      background: "#ffffff",
                      fontSize: 16,
                      padding: "10px 12px",
                      borderRadius: 18,
                      boxShadow: "0 0 0 1px #e3eef7 inset",
                    }}
                    title={formatDateShortRu(date)}
                  >
                    {weekdayRu(date)}
                    <br />
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        opacity: 0.7,
                        letterSpacing: ".06em",
                      }}
                    >
                      {formatDateShortRu(date)}
                    </span>
                  </th>
                  {hours.map((h) => {
                    const sl = slotMap[date]?.[h];
                    const isSel =
                      selected &&
                      selected.date === date &&
                      selected.hour === h;
                    const isBreak = sl?.isBreak;
                    const freePlaces = sl?.freePlaces ?? 0;
                    const bg = !sl
                      ? "#d0d7dd"
                      : isBreak
                      ? "#e7eff5"
                      : colorForFreePlaces(freePlaces);
                    return (
                      <td key={h}>
                        <div
                          className={
                            "heatmap-cell" +
                            (isSel ? " selected" : "") +
                            (isBreak ? " break" : "")
                          }
                          style={{
                            background: isBreak
                              ? undefined
                              : `linear-gradient(135deg, ${bg} 0%, ${bg} 70%, rgba(255,255,255,0.18) 100%)`,
                            color: isBreak ? "#185a90" : "#fff",
                            fontSize:
                              freePlaces >= 100
                                ? 22
                                : freePlaces < 10
                                ? 26
                                : 24,
                          }}
                          onClick={() => handleCellClick(date, h)}
                          onMouseEnter={(e) =>
                            handleMouseEnterCell(e, date, h)
                          }
                          onMouseLeave={handleMouseLeaveCell}
                        >
                          {isBreak ? "ПЕРЕРЫВ" : freePlaces}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="heatmap-legend">
          <div>
            <div className="heatmap-legend-bar" />
            <div className="heatmap-legend-labels">
              <span>0</span>
              <span>половина</span>
              <span>макс</span>
            </div>
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#185a90",
              letterSpacing: ".05em",
              padding: "10px 20px",
              background: "#ffffff",
              borderRadius: 22,
              boxShadow:
                "0 14px 40px -18px rgba(24,90,144,.35), 0 4px 16px -8px rgba(24,90,144,.25)",
            }}
          >
            Цвет = свободные места
          </div>
        </div>

        {popup && (
          <div
            ref={popupRef}
            className="heatmap-popup"
            style={{
              left: popup.x,
              top: popup.y,
            }}
          >
            <h4>
              {popup.hour}:00 – {popup.hour + 1}:00
              {popup.current != null &&
                popup.date === currentNow?.date &&
                popup.hour === currentNow?.hour && (
                  <span className="heatmap-status-badge">
                    {popup.source === "previousHour"
                      ? "Пред. час"
                      : "Текущий"}
                  </span>
                )}
            </h4>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
              {weekdayRu(popup.date)}, {formatDateShortRu(popup.date)}
            </div>
            {popup.isBreak ? (
              <div style={{ fontWeight: 800, fontSize: 15 }}>ПЕРЕРЫВ</div>
            ) : (
              <>
                <div style={{ marginTop: 2 }}>
                  Свободно мест:{" "}
                  <b style={{ fontSize: 20 }}>{popup.freePlaces}</b>
                </div>
                <div style={{ marginTop: 2 }}>
                  Свободно дорожек:{" "}
                  <b style={{ fontSize: 18 }}>{popup.freeLanes}</b>
                </div>
                {popup.current != null && (
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 13,
                      opacity: 0.8,
                      lineHeight: 1.4,
                    }}
                  >
                    Сейчас в бассейне:{" "}
                    <b style={{ fontSize: 15 }}>{popup.current}</b>
                    {popup.source &&
                      popup.source !== "exact" &&
                      popup.source !== "none" && (
                        <span style={{ marginLeft: 6 }}>
                          ({popup.source === "previousHour"
                            ? "пред. час"
                            : popup.source})
                        </span>
                      )}
                  </div>
                )}
              </>
            )}
            <small>нажатие фиксирует подсветку</small>
          </div>
        )}
      </div>

      {loading && (
        <div className="pool-loading-overlay">
          <div className="pool-spinner" />
          <p style={{ color: "#185a90", fontWeight: 700 }}>Загрузка...</p>
        </div>
      )}
      {error && <div className="pool-error">Ошибка: {error}</div>}
    </div>
  );
};

export default PoolHeatmap;