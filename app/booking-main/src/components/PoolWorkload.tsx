import React, { useEffect, useMemo, useRef, useState } from "react";
import TemperatureWidget from "./TemperatureWidget";

// == CONFIG ==
const BAR_WIDTH = 60;
const BAR_GAP = 11;
const LEFT_PADDING = 100;
const TOP_PADDING = 28;
const TOTAL_LANES = 10;
const LANE_CAPACITY = 12;
const SEGMENT_HEIGHT = 12;
const SEGMENT_GAP = 3;
const COLOR_TOP = "#185a90";
const COLOR_BOTTOM = "#99e8fa";
const INACTIVE_COLOR = "#eaf1f8";
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
  meta: {
    serverNowDate: string;
    serverNowHour: number;
    tzOffset: number;
  };
  slots: Slot[];
}

interface PopupState {
  left: number;
  top: number;
  value: number;
  hour: number;
  isBreak: boolean;
  visible: boolean;
}

export type PoolWorkloadMode = "full" | "mini";
interface PoolWorkloadProps {
  compact?: boolean;
  mode?: PoolWorkloadMode;
  onHourSelect?: (date: string, hour: number) => void;
}

// == HELPERS ==
function formatDateShortRu(iso: string) {
  if (!iso) return "";
  const [, m, d] = iso.split("-");
  const months = [
    "января","февраля","марта","апреля","мая","июня",
    "июля","августа","сентября","октября","ноября","декабря"
  ];
  return `${+d} ${months[+m - 1]}`;
}
function getWeekdayRu(iso: string) {
  const names = [
    "Воскресенье","Понедельник","Вторник","Среда",
    "Четверг","Пятница","Суббота"
  ];
  return names[new Date(iso).getDay()];
}
function isBreakHour(dateIso: string, hour: number) {
  if (hour !== 12) return false;
  const d = new Date(dateIso).getDay();
  return d >= 1 && d <= 5;
}
function lerpColor(a: string, b: string, t: number) {
  const ah = a.replace("#","");
  const bh = b.replace("#","");
  const ar = parseInt(ah.slice(0,2),16);
  const ag = parseInt(ah.slice(2,4),16);
  const ab = parseInt(ah.slice(4,6),16);
  const br = parseInt(bh.slice(0,2),16);
  const bg = parseInt(bh.slice(2,4),16);
  const bb = parseInt(bh.slice(4,6),16);
  const rr = Math.round(ar + (br - ar)*t);
  const rg = Math.round(ag + (bg - ag)*t);
  const rb = Math.round(ab + (bb - ab)*t);
  return "#" + ((1<<24) + (rr<<16)+(rg<<8)+rb).toString(16).slice(1);
}

// == POPUP ==
const ColumnPopup: React.FC<{
  value: number;
  hour: number;
  isBreak: boolean;
}> = ({ value, hour, isBreak }) => {
  return (
    <div
      style={{
        width: 186,
        minHeight: 82,
        background: "#fff",
        borderRadius: 20,
        boxShadow: "0 4px 24px rgba(24,90,144,0.13)",
        border: "1.5px solid #eaf1f8",
        padding: "16px 18px 10px 18px",
        fontWeight: 700,
        color: "#183a58",
        textAlign: "center",
        pointerEvents: "none",
        fontFamily: "inherit",
        fontSize: 14,
        lineHeight: 1.12,
        position: "relative",
        zIndex: 12,
      }}
    >
      <div style={{ fontSize: 14, color: "#185a90", fontWeight: 800, marginBottom: 2 }}>
        {hour}:00 — {hour + 1}:00
      </div>
      {!isBreak ? (
        <>
          <div style={{ fontSize: 31, fontWeight: 900, color: "#181a1b", lineHeight: 1, marginBottom: 2 }}>
            {value}
            <span style={{ fontSize: 13, marginLeft: 4 }}>дорожек</span>
          </div>
          <div style={{ marginTop: 1, fontSize: 12, color: "#4b6b88" }}>
            {value * 12} мест
          </div>
        </>
      ) : (
        <div style={{ fontSize: 17, fontWeight: 800, color: "#185a90" }}>ПЕРЕРЫВ</div>
      )}
      {/* стрелочка */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: -12,
          transform: "translateX(-50%)",
          width: 24,
          height: 15,
          zIndex: 1,
          overflow: "visible",
          pointerEvents: "none",
        }}
      >
        <svg width={24} height={15} viewBox="0 0 24 15" fill="none">
          <path
            d="M0 0 Q12 22 24 0"
            fill="#fff"
            stroke="#eaf1f8"
            strokeWidth="1.5"
          />
        </svg>
      </div>
    </div>
  );
};

const PoolWorkload: React.FC<PoolWorkloadProps> = ({ compact, mode = "full", onHourSelect }) => {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [currentNow, setCurrentNow] = useState<CurrentNow | null>(null);
  const [meta, setMeta] = useState<ApiResponse["meta"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [popup, setPopup] = useState<PopupState | null>(null);
  const popupTimeout = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const hourColumns = useMemo(
    () => Array.from({length: HOUR_END - HOUR_START + 1},(_,i)=>HOUR_START+i),
    []
  );

  // == DATA LOAD ==
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
    } catch (e:any) {
      setError(e.message || "Ошибка запроса");
    } finally {
      setLoading(false);
    }
  };

  useEffect(()=> {
    fetchData();
  }, []);

  const dates = useMemo(()=>{
    const s = new Set<string>();
    for (const sl of slots) s.add(sl.date);
    return Array.from(s).sort();
  }, [slots]);

  useEffect(()=> {
    if (meta?.serverNowDate && dates.length) {
      const idx = dates.indexOf(meta.serverNowDate);
      if (idx >= 0) setSelectedIdx(idx);
    }
  }, [meta?.serverNowDate, dates]);

  const freeMatrix = useMemo(()=>{
    const m: Record<string, Record<number, number>> = {};
    for (const s of slots) {
      if (!m[s.date]) m[s.date] = {};
      m[s.date][s.hour] = s.freeLanes;
    }
    return m;
  }, [slots]);

  // === POPUP LOGIC ===
  function showPopupAtClient(clientX: number, clientY: number, val: number, h: number, br: boolean) {
    if (!containerRef.current) return;
    if (popupTimeout.current) window.clearTimeout(popupTimeout.current);
    const rect = containerRef.current.getBoundingClientRect();

    const popupW = 186;
    const popupH = 82;

    let localX = clientX - rect.left + (scrollRef.current?.scrollLeft || 0);
    let localY = clientY - rect.top + (scrollRef.current?.scrollTop || 0);

    let left = Math.max(popupW/2+8, Math.min(rect.width-popupW/2-8, localX));
    let top = Math.max(10, Math.min(rect.height-popupH-30, localY-popupH-22));

    setPopup({
      left,
      top,
      value: val,
      hour: h,
      isBreak: br,
      visible: true,
    });
  }

  function hidePopupDelayed(){
    if (popupTimeout.current) window.clearTimeout(popupTimeout.current);
    popupTimeout.current = window.setTimeout(() => {
      setPopup((p) => p && { ...p, visible: false });
    }, 120);
  }
  function cancelHide(){
    if (popupTimeout.current) window.clearTimeout(popupTimeout.current);
    setPopup((p) => p && { ...p, visible: true });
  }

  useEffect(() => {
    return () => {
      if (popupTimeout.current) window.clearTimeout(popupTimeout.current);
    };
  }, []);

  const chartWidth =
    LEFT_PADDING*2 +
    hourColumns.length * (BAR_WIDTH + BAR_GAP) -
    BAR_GAP;
  const chartHeight =
    TOP_PADDING + (SEGMENT_HEIGHT + SEGMENT_GAP) * TOTAL_LANES + 60;

  const current = currentNow?.current ?? null;
  const totalPlaces = TOTAL_LANES * LANE_CAPACITY;
  const freePlaces = current == null ? "—" : Math.max(0, totalPlaces - current);

  // === HANDLERS ===
  const makeMouseHandlers = (h: number, val: number, br: boolean) => {
    return {
      onMouseEnter: (e: React.MouseEvent) => showPopupAtClient(e.clientX, e.clientY, val, h, br),
      onMouseMove: (e: React.MouseEvent) => {
        cancelHide();
        showPopupAtClient(e.clientX, e.clientY, val, h, br);
      },
      onMouseLeave: () => hidePopupDelayed(),
      onTouchStart: (e: React.TouchEvent) => {
        const t = e.touches && e.touches[0];
        if (!t) return;
        cancelHide();
        showPopupAtClient(t.clientX, t.clientY, val, h, br);
      },
      onTouchMove: (e: React.TouchEvent) => {
        const t = e.touches && e.touches[0];
        if (!t) return;
        cancelHide();
        showPopupAtClient(t.clientX, t.clientY, val, h, br);
      },
      onTouchEnd: () => hidePopupDelayed(),
      onClick: () => {
        if (val > 0 && onHourSelect) {
          const date = dates[selectedIdx];
          onHourSelect(date, h);
        }
      },
    };
  };

  // === UI ===
  return (
    <div
      className="pool-root"
      style={{
        position: "relative",
        fontSize: 18,
        background: "#f5faff",
        minHeight: 845,
        padding: 0,
        boxShadow: "none"
      }}
    >
      {/* Chart card */}
      <div style={{
        background: "#fff",
        borderRadius: 38,
        boxShadow: "0 10px 40px #185a9020",
        margin: "0 auto",
        maxWidth: 1680,
        padding: "0 0 8px 0",
        position: "relative",
      }}>
        <div className="pool-dates-row" role="tablist" aria-label="Даты" style={{
          display: "flex",
          gap: 18,
          margin: "0 0 10px 0",
          padding: "32px 0 0 60px"
        }}>
          {dates.map((d, idx) => {
            const active = idx === selectedIdx;
            return (
              <div
                key={d}
                className={"pool-date-chip" + (active ? " pool-date-chip-active" : "")}
                onClick={() => setSelectedIdx(idx)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") setSelectedIdx(idx); }}
                aria-pressed={active}
                style={{
                  padding: "12px 30px",
                  borderRadius: 20,
                  background: active ? "linear-gradient(90deg,#a24bff,#4b6bff)" : "#f5fbff",
                  color: active ? "#fff" : "#185a90",
                  fontWeight: 900,
                  fontSize: 21,
                  boxShadow: active ? "0 4px 16px #a24bff22" : "0 2px 10px #185a9006",
                  lineHeight: 1.08,
                  border: "none"
                }}
              >
                <div>{formatDateShortRu(d)}</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{getWeekdayRu(d)}</div>
              </div>
            );
          })}
        </div>

        <div style={{
          textAlign: "center",
          marginBottom: 0,
          fontSize: 27,
          color: "#185a90",
          fontWeight: 900,
          marginTop: -8,
          letterSpacing: ".01em"
        }}>
          Свободно
        </div>

        {/* Chart! */}
        <div
          ref={scrollRef}
          style={{
            position: "relative",
            minWidth: "100%",
            maxWidth: chartWidth,
            margin: "0 auto",
            overflowX: "auto",
            borderRadius: "inherit",
          }}
        >
          <div ref={containerRef} style={{ width: chartWidth, minWidth: chartWidth, position: "relative" }}>
            <svg width={chartWidth} height={chartHeight} style={{ display: "block" }}>
              {hourColumns.map((h, hourIdx) => {
                const date = dates[selectedIdx];
                let val = freeMatrix[date]?.[h] ?? 0;
                const br = isBreakHour(date, h);
                if (br) val = 0;
                const x = LEFT_PADDING + hourIdx * (BAR_WIDTH + BAR_GAP);
                return (
                  <g key={h}>
                    {Array.from({ length: TOTAL_LANES }, (_, segIdx) => {
                      const segY = TOP_PADDING + segIdx * (SEGMENT_HEIGHT + SEGMENT_GAP);
                      if (br) {
                        return (
                          <rect
                            key={segIdx}
                            x={x}
                            y={segY}
                            width={BAR_WIDTH}
                            height={SEGMENT_HEIGHT}
                            rx={6}
                            fill={INACTIVE_COLOR}
                          />
                        );
                      }
                      const active = segIdx >= TOTAL_LANES - val;
                      const tcol = val > 1 ? (segIdx - (TOTAL_LANES - val)) / (val - 1) : 0;
                      return (
                        <rect
                          key={segIdx}
                          x={x}
                          y={segY}
                          width={BAR_WIDTH}
                          height={SEGMENT_HEIGHT}
                          rx={6}
                          fill={active ? lerpColor(COLOR_TOP, COLOR_BOTTOM, tcol) : INACTIVE_COLOR}
                          style={{ cursor: active ? "pointer" : "default" }}
                          onClick={() => {
                            if (active && onHourSelect) onHourSelect(date, h);
                          }}
                        />
                      );
                    })}
                    {br && (
                      <text
                        x={x + BAR_WIDTH / 2}
                        y={TOP_PADDING + (TOTAL_LANES * (SEGMENT_HEIGHT + SEGMENT_GAP)) / 2}
                        textAnchor="middle"
                        fill="#185a90"
                        fontWeight={700}
                        fontSize={21}
                        style={{ writingMode: "vertical-rl", userSelect: "none", letterSpacing: ".12em" }}
                      >
                        ПЕРЕРЫВ
                      </text>
                    )}
                  </g>
                );
              })}

              {hourColumns.map((h) => {
                const x = LEFT_PADDING + (h - HOUR_START) * (BAR_WIDTH + BAR_GAP);
                return (
                  <text
                    key={"h-" + h}
                    x={x + BAR_WIDTH / 2}
                    y={TOP_PADDING + (SEGMENT_HEIGHT + SEGMENT_GAP) * TOTAL_LANES + 46}
                    textAnchor="middle"
                    fill="#185a90"
                    fontWeight={700}
                    fontSize={22}
                  >
                    {h}:00
                  </text>
                );
              })}
            </svg>

            {/* HTML overlays – обработчики на overlay, попап ездит за мышью, constrained inside container */}
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: chartWidth,
                height: chartHeight,
                pointerEvents: "none",
              }}
            >
              {hourColumns.map((h, hourIdx) => {
                const date = dates[selectedIdx];
                const val = freeMatrix[date]?.[h] ?? 0;
                const br = isBreakHour(date, h);
                const leftPx = LEFT_PADDING + hourIdx * (BAR_WIDTH + BAR_GAP);
                const overlayHeight = (SEGMENT_HEIGHT + SEGMENT_GAP) * TOTAL_LANES;
                const handlers = makeMouseHandlers(h, val, br);
                return (
                  <div
                    key={`overlay-${h}`}
                    style={{
                      position: "absolute",
                      left: leftPx,
                      top: TOP_PADDING,
                      width: BAR_WIDTH,
                      height: overlayHeight,
                      pointerEvents: "auto",
                      background: "transparent",
                      touchAction: "manipulation",
                    }}
                    {...handlers}
                  />
                );
              })}
            </div>

            {/* Popup (HTML) positioned inside containerRef and constrained */}
            {popup && containerRef.current && (
              <div
                style={{
                  position: "absolute",
                  left: popup.left,
                  top: popup.top,
                  transform: "translate(-50%, 0)",
                  transition: "left 140ms cubic-bezier(.2,.9,.2,1), top 140ms cubic-bezier(.2,.9,.2,1), opacity 120ms",
                  opacity: popup.visible ? 1 : 0,
                  pointerEvents: "none",
                  zIndex: 120,
                }}
              >
                <ColumnPopup value={popup.value} hour={popup.hour} isBreak={popup.isBreak} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scroll controls */}
      <div style={{ padding: "16px 56px 0", display: "flex", gap: 16 }}>
        <button
          className="pool-scroll-btn"
          style={{
            width: 48, height: 48, fontSize: 28, borderRadius: 14, background: "#fff", boxShadow: "0 2px 16px #185a9020", border: "none", cursor: "pointer"
          }}
          onClick={() => { if (scrollRef.current) scrollRef.current.scrollLeft -= 180; }}
        >
          ◀
        </button>
        <button
          className="pool-scroll-btn"
          style={{
            width: 48, height: 48, fontSize: 28, borderRadius: 14, background: "#fff", boxShadow: "0 2px 16px #185a9020", border: "none", cursor: "pointer"
          }}
          onClick={() => { if (scrollRef.current) scrollRef.current.scrollLeft += 180; }}
        >
          ▶
        </button>
      </div>

      {loading && (
        <div className="pool-loading-overlay">
          <div className="pool-spinner" />
          <p style={{ color: '#185a90', fontWeight: 700 }}>Загрузка данных...</p>
        </div>
      )}
      {error && <div className="pool-error">Ошибка: {error}</div>}
    </div>
  );
};

export default PoolWorkload;