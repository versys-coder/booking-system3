import React, { useEffect, useMemo, useRef, useState } from "react";

// --- Константы ---
const BAR_WIDTH = 50;
const BAR_GAP = 5;
const LEFT_PADDING = 30;
const TOP_PADDING = 24;
const TOTAL_LANES = 10;
const LANE_CAPACITY = 12;
const SEGMENT_HEIGHT = 11;
const SEGMENT_GAP = 3;
const COLOR_TOP = "#185a90";
const COLOR_BOTTOM = "#99e8fa";
const INACTIVE_COLOR = "#eaf1f8";
const HOUR_START = 7;
const HOUR_END = 21;

// --- Helpers ---
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
const getSwimPrice = (hour: number): number => (hour >= 7 && hour < 17 ? 600 : 650);

// --- PopUp ---
const ColumnPopup: React.FC<{ value: number; hour: number; isBreak: boolean }> = ({ value, hour, isBreak }) => (
  <div className="poolworkload-popup">
    <div className="poolworkload-popup-time">{hour}:00–{hour + 1}:00</div>
    {!isBreak ? (
      <>
        <div className="poolworkload-popup-lanes">
          {value}<span>дорожек</span>
        </div>
        <div className="poolworkload-popup-places">{value * 12} мест</div>
        <div className="poolworkload-popup-price">{getSwimPrice(hour)} ₽ <span>Свободное плавание</span></div>
      </>
    ) : (
      <div className="poolworkload-popup-break">ПЕРЕРЫВ</div>
    )}
    <div className="poolworkload-popup-arrow">
      <svg width={18} height={12} viewBox="0 0 18 12" fill="none">
        <path d="M0 0 Q9 16 18 0" fill="#fff" stroke="#eaf1f8" strokeWidth="1.5" />
      </svg>
    </div>
  </div>
);

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
interface ApiResponse {
  slots: Slot[];
  currentNow: any;
  meta: any;
}
interface PopupState {
  left: number;
  top: number;
  value: number;
  hour: number;
  isBreak: boolean;
  visible: boolean;
}

const PoolWorkload1: React.FC = () => {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [popup, setPopup] = useState<PopupState | null>(null);
  const popupTimeout = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch("/api/pool-workload?start_hour=7&end_hour=21")
      .then((res) => res.json())
      .then((data: ApiResponse) => setSlots(data.slots || []));
  }, []);

  const hourColumns = useMemo(
    () => Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i),
    []
  );
  const dates = useMemo(() => {
    const s = new Set<string>();
    for (const sl of slots) s.add(sl.date);
    return Array.from(s).sort();
  }, [slots]);

  const freeMatrix = useMemo(() => {
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
    const popupW = 140;
    const popupH = 92;
    let localX = clientX - rect.left + (scrollRef.current?.scrollLeft || 0);
    let localY = clientY - rect.top + (scrollRef.current?.scrollTop || 0);
    let left = Math.max(popupW / 2 + 4, Math.min(rect.width - popupW / 2 - 4, localX));
    let top = Math.max(8, Math.min(rect.height - popupH - 12, localY - popupH - 10));
    setPopup({
      left,
      top,
      value: val,
      hour: h,
      isBreak: br,
      visible: true,
    });
  }
  function hidePopupDelayed() {
    if (popupTimeout.current) window.clearTimeout(popupTimeout.current);
    popupTimeout.current = window.setTimeout(() => {
      setPopup((p) => p && { ...p, visible: false });
    }, 120);
  }
  function cancelHide() {
    if (popupTimeout.current) window.clearTimeout(popupTimeout.current);
    setPopup((p) => p && { ...p, visible: true });
  }
  useEffect(() => () => {
    if (popupTimeout.current) window.clearTimeout(popupTimeout.current);
  }, []);

  const chartWidth =
    LEFT_PADDING * 2 + hourColumns.length * (BAR_WIDTH + BAR_GAP) - BAR_GAP;
  const chartHeight =
    TOP_PADDING + (SEGMENT_HEIGHT + SEGMENT_GAP) * TOTAL_LANES + 60;

  const makeMouseHandlers = (h: number, val: number, br: boolean) => ({
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
  });

  // --- UI ---
  return (
    <div className="poolworkload-root">
      <div className="poolworkload-card">
        <div className="poolworkload-dates-row">
          {dates.map((d, idx) => {
            const active = idx === selectedIdx;
            return (
              <div
                key={d}
                className={"poolworkload-date" + (active ? " poolworkload-date-active" : "")}
                onClick={() => setSelectedIdx(idx)}
                tabIndex={0}
                aria-pressed={active}
              >
                <div className="poolworkload-date-dot" />
                <div className="poolworkload-date-labels">
                  <span className="poolworkload-date-main">{formatDateShortRu(d)}</span>
                  <span className="poolworkload-date-weekday">{getWeekdayRu(d)}</span>
                </div>
              </div>
            );
          })}
        </div>
                <div
          ref={scrollRef}
          className="poolworkload-chart-scroll"
          style={{ maxWidth: chartWidth }}
        >
          <div
            ref={containerRef}
            className="poolworkload-chart-container"
            style={{ width: chartWidth, minWidth: chartWidth }}
          >
            <svg width={chartWidth} height={chartHeight} className="poolworkload-equalizer">
              {/* Эквалайзер и свободные дорожки */}
              {hourColumns.map((h, hourIdx) => {
                const date = dates[selectedIdx];
                let val = freeMatrix[date]?.[h] ?? 0;
                const br = isBreakHour(date, h);
                if (br) val = 0;
                const x = LEFT_PADDING + hourIdx * (BAR_WIDTH + BAR_GAP);
                return (
                  <g key={h}>
                    {/* Верхнее число */}
                    <text
                      x={x + BAR_WIDTH / 2}
                      y={TOP_PADDING - 6}
                      textAnchor="middle"
                      fill="#185a90"
                      fontWeight={700}
                      fontSize={14}
                    >
                      {val}
                    </text>
                    {/* Сегменты */}
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
                            rx={4}
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
                          rx={4}
                          fill={active ? lerpColor(COLOR_TOP, COLOR_BOTTOM, tcol) : INACTIVE_COLOR}
                          className={active ? "poolworkload-equalizer-segment" : ""}
                        />
                      );
                    })}
                    {/* ПЕРЕРЫВ вертикально */}
                    {br && (
                      <text
                        x={x + BAR_WIDTH / 2}
                        y={TOP_PADDING + (TOTAL_LANES * (SEGMENT_HEIGHT + SEGMENT_GAP)) / 2}
                        textAnchor="middle"
                        fill="#185a90"
                        fontWeight={700}
                        fontSize={12}
                        className="poolworkload-break-text"
                        style={{ writingMode: "vertical-rl", letterSpacing: "0.1em", userSelect: "none" }}
                      >
                        ПЕРЕРЫВ
                      </text>
                    )}
                  </g>
                );
              })}
              {/* часы */}
              {hourColumns.map((h) => {
                const x = LEFT_PADDING + (h - HOUR_START) * (BAR_WIDTH + BAR_GAP);
                return (
                  <text
                    key={"h-" + h}
                    x={x + BAR_WIDTH / 2}
                    y={TOP_PADDING + (SEGMENT_HEIGHT + SEGMENT_GAP) * TOTAL_LANES + 24}
                    textAnchor="middle"
                    fill="#185a90"
                    fontWeight={700}
                    fontSize={13}
                  >
                    {h}:00
                  </text>
                );
              })}
            </svg>
            {/* Overlays */}
            <div className="poolworkload-chart-overlay">
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
                    className="poolworkload-chart-overlay-col"
                    style={{
                      left: leftPx,
                      top: TOP_PADDING,
                      width: BAR_WIDTH,
                      height: overlayHeight,
                    }}
                    {...handlers}
                  />
                );
              })}
            </div>
            {/* Popup */}
            {popup && containerRef.current && (
              <div
                className="poolworkload-popup-wrapper"
                style={{
                  left: popup.left,
                  top: popup.top,
                  opacity: popup.visible ? 1 : 0,
                }}
              >
                <ColumnPopup value={popup.value} hour={popup.hour} isBreak={popup.isBreak} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PoolWorkload1;