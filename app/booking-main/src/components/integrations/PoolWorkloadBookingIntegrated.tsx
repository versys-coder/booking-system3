import React, { useEffect, useMemo, useRef, useState } from "react";

// Копия ключевых констант из PoolWorkload (НЕ меняем оригинал)
const BAR_WIDTH = 60;
const BAR_GAP = 11;
const LEFT_PADDING = 100;
const TOP_PADDING = 28;
const TOTAL_LANES = 10;
const LANE_CAPACITY = 12;
const SEGMENT_HEIGHT = 12;
const SEGMENT_GAP = 3;
const COLOR_TOP = "var(--theme-bg-active)";
const COLOR_BOTTOM = "#99e8fa";
const INACTIVE_COLOR = "#eaf1f8";
const HOUR_START = 7;
const HOUR_END = 21;

interface Slot {
  date: string;
  hour: number;
  freeLanes: number;
  isBreak: boolean;
  current: number | null;
  totalLanes: number;
  freePlaces: number;
  totalPlaces: number;
}
interface ApiResponse {
  slots: Slot[];
  meta?: any;
  currentNow?: any;
}

interface PopupState {
  left: number;
  top: number;
  hour: number;
  value: number;
  isBreak: boolean;
}

interface Props {
  onSelectSlot: (date: string, hour: number) => void;
}

function isBreakHour(dateIso: string, hour: number) {
  if (hour !== 12) return false;
  const d = new Date(dateIso).getDay();
  return d >= 1 && d <= 5;
}

function lerpColor(a: string, b: string, t: number) {
  // a, b — hex либо var(...)
  function parseColor(color: string): [number, number, number] {
    if (color.startsWith("var(")) {
      // Попробовать получить из computed style
      const v = getComputedStyle(document.documentElement).getPropertyValue(
        color.slice(4, -1)
      );
      color = v?.trim() || "#185a90";
    }
    const hex = color.replace("#", "");
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  }
  const [ar, ag, ab] = parseColor(a);
  const [br, bg, bb] = parseColor(b);
  const rr = Math.round(ar + (br - ar) * t);
  const rg = Math.round(ag + (bg - ag) * t);
  const rb = Math.round(ab + (bb - ab) * t);
  return "#" + ((1 << 24) | (rr << 16) | (rg << 8) | rb).toString(16).slice(1);
}

const Popup: React.FC<
  PopupState & { date: string; onBook: () => void }
> = ({ hour, value, isBreak, left, top, onBook }) => (
  <div
    style={{
      position: "absolute",
      left,
      top,
      minWidth: 160,
      background: "var(--color-white)",
      borderRadius: "var(--theme-radius)",
      boxShadow: "0 2.5px 22px rgba(24,90,144,.11)",
      padding: "18px 20px 14px",
      zIndex: 300,
      fontSize: 18,
      color: "var(--theme-color)",
      fontWeight: 600,
      border: "1px solid #eaf8ff",
      fontFamily: "var(--theme-font-family)",
    }}
  >
    <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 6 }}>
      {hour}:00–{hour + 1}:00
    </div>
    {isBreak ? (
      <div style={{ fontSize: 16, fontWeight: 800 }}>ПЕРЕРЫВ</div>
    ) : (
      <>
        <div style={{ fontSize: 16, marginBottom: 6 }}>
          Свободно дорожек: <b>{value}</b>
        </div>
        <div style={{ fontSize: 14, marginBottom: 10 }}>
          Свободно мест: <b>{value * LANE_CAPACITY}</b>
        </div>
        <button
          style={{
            padding: "8px 14px",
            borderRadius: "var(--theme-radius)",
            background: "var(--theme-bg-active)",
            color: "var(--theme-color-active)",
            fontWeight: 700,
            cursor: "pointer",
            border: "none",
            width: "100%",
            fontFamily: "var(--theme-font-family)",
          }}
          onClick={onBook}
          disabled={isBreak || value <= 0}
        >
          Забронировать
        </button>
      </>
    )}
  </div>
);

const PoolWorkloadBookingIntegrated: React.FC<Props> = ({ onSelectSlot }) => {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [popup, setPopup] = useState<PopupState | null>(null);
  const [dates, setDates] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const popupTimeout = useRef<number | null>(null);

  const hourColumns = useMemo(
    () => Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i),
    []
  );

  async function fetchData() {
    try {
      setLoading(true);
      const res = await fetch("/api/pool-workload?start_hour=7&end_hour=21");
      if (!res.ok) throw new Error(res.statusText);
      const data: ApiResponse = await res.json();
      const normalized = data.slots.map((s: any) => ({
        date: s.date,
        hour: s.hour,
        freeLanes: s.freeLanes ?? 0,
        isBreak: isBreakHour(s.date, s.hour),
        current: s.current ?? null,
        totalLanes: s.totalLanes ?? TOTAL_LANES,
        freePlaces: s.freePlaces ?? (s.freeLanes ?? 0) * LANE_CAPACITY,
        totalPlaces: s.totalPlaces ?? TOTAL_LANES * LANE_CAPACITY,
      }));
      setSlots(normalized);
      const dset = Array.from(new Set(normalized.map((s) => s.date))).sort();
      setDates(dset);
      setSelectedIdx(0);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  const freeMatrix = useMemo(() => {
    const m: Record<string, Record<number, number>> = {};
    for (const s of slots) {
      if (!m[s.date]) m[s.date] = {};
      m[s.date][s.hour] = s.freeLanes;
    }
    return m;
  }, [slots]);

  function showPopup(x: number, y: number, val: number, hour: number, isBreak: boolean) {
    setPopup({ left: x - 60, top: y - 110, value: val, hour, isBreak });
  }
  function hidePopup() {
    if (popupTimeout.current) clearTimeout(popupTimeout.current);
    popupTimeout.current = window.setTimeout(() => setPopup(null), 250);
  }
  function cancelHide() {
    if (popupTimeout.current) clearTimeout(popupTimeout.current);
  }

  const chartWidth =
    LEFT_PADDING * 2 + hourColumns.length * (BAR_WIDTH + BAR_GAP) - BAR_GAP;
  const chartHeight =
    TOP_PADDING + (SEGMENT_HEIGHT + SEGMENT_GAP) * TOTAL_LANES + 60;

  const date = dates[selectedIdx];

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {dates.map((d, idx) => {
          const active = idx === selectedIdx;
          return (
            <button
              key={d}
              onClick={() => setSelectedIdx(idx)}
              style={{
                padding: "8px 16px",
                borderRadius: "var(--theme-radius)",
                background: active ? "var(--theme-bg-active)" : "var(--color-white)",
                color: active ? "var(--theme-color-active)" : "var(--theme-color)",
                fontWeight: 800,
                border: "1px solid #cfe8f7",
                fontSize: active ? 20 : 18,
                cursor: "pointer",
                fontFamily: "var(--theme-font-family)",
                transition: "background .16s, color .16s"
              }}
            >
              {d}
            </button>
          );
        })}
      </div>
      <div style={{ position: "relative" }}>
        <div
          ref={scrollRef}
          style={{
            position: "relative",
            minWidth: "100%",
            overflowX: "auto",
            padding: "4px 0 28px",
          }}
        >
          <div style={{ width: chartWidth, minWidth: chartWidth }}>
            <svg width={chartWidth} height={chartHeight} style={{ display: "block" }}>
              {hourColumns.map((h, hourIdx) => {
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
                          fill={
                            active
                              ? lerpColor(COLOR_TOP, COLOR_BOTTOM, tcol)
                              : INACTIVE_COLOR
                          }
                          style={{ cursor: active ? "pointer" : "default" }}
                          onMouseEnter={
                            active
                              ? () =>
                                  showPopup(
                                    x + BAR_WIDTH / 2,
                                    segY,
                                    val,
                                    h,
                                    br
                                  )
                              : undefined
                          }
                          onMouseLeave={hidePopup}
                          onMouseMove={cancelHide}
                          onClick={() => {
                            if (!br && val > 0) {
                              onSelectSlot(date, h);
                            }
                          }}
                        />
                      );
                    })}
                    <text
                      x={x + BAR_WIDTH / 2}
                      y={
                        TOP_PADDING + (SEGMENT_HEIGHT + SEGMENT_GAP) * TOTAL_LANES + 46
                      }
                      textAnchor="middle"
                      fill="var(--theme-color)"
                      fontWeight={700}
                      fontSize={22}
                      fontFamily="var(--theme-font-family)"
                    >
                      {h}:00
                    </text>
                  </g>
                );
              })}
            </svg>
            {popup && (
              <Popup
                {...popup}
                date={date}
                onBook={() => {
                  if (!popup.isBreak && popup.value > 0) {
                    onSelectSlot(date, popup.hour);
                  }
                }}
              />
            )}
          </div>
        </div>
      </div>
      {loading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(255,255,255,.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            color: "var(--theme-color)",
            fontFamily: "var(--theme-font-family)",
          }}
        >
          Загрузка...
        </div>
      )}
    </div>
  );
};

export default PoolWorkloadBookingIntegrated;