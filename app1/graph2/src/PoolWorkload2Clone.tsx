/// <reference types="react" />
import React, { useEffect, useMemo, useRef, useState } from "react";

// Константы как в оригинальном PoolWorkload2
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

// Высота столбика
const BAR_TOTAL_HEIGHT = TOTAL_LANES * SEGMENT_HEIGHT + (TOTAL_LANES - 1) * SEGMENT_GAP;

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

const PoolWorkload2Clone: React.FC = () => {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [popup, setPopup] = useState<PopupState | null>(null);
  const popupTimeout = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const hours = useMemo(
    () => Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i),
    []
  );
  // Ширина области под все часы
  const chartWidth = useMemo(
    () => LEFT_PADDING + hours.length * (BAR_WIDTH + BAR_GAP) - BAR_GAP,
    [hours]
  );

  useEffect(() => {
    fetch("/api/pool-workload?start_hour=7&end_hour=21")
      .then((res) => res.json())
      .then((data: ApiResponse) => setSlots(data.slots || []));
  }, []);

  const dates = useMemo(() => {
    const s = new Set<string>();
    for (const sl of slots) s.add(sl.date);
    return Array.from(s).sort();
  }, [slots]);

  const byDateHour = useMemo(() => {
    const m: Record<string, Record<number, Slot>> = {};
    for (const s of slots) {
      (m[s.date] ||= {})[s.hour] = s;
    }
    return m;
  }, [slots]);

  const cancelHide = () => {
    if (popupTimeout.current) {
      window.clearTimeout(popupTimeout.current);
      popupTimeout.current = null;
    }
  };
  const hidePopupDelayed = () => {
    cancelHide();
    popupTimeout.current = window.setTimeout(() => {
      setPopup((p) => (p ? { ...p, visible: false } : null));
    }, 80);
  };
  const showPopupAtEl = (
    el: HTMLElement,
    value: number,
    hour: number,
    isBreak: boolean
  ) => {
    const rect = el.getBoundingClientRect();
    setPopup({
      left: rect.left + rect.width / 2,
      top: rect.top - 8,
      value,
      hour,
      isBreak,
      visible: true,
    });
  };

  const activeDate = dates[selectedIdx];

  return (
    <div className="poolworkload-root">
      <div className="poolworkload-card">
        {/* Пилюли дат (как в variant2) */}
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

        <div className="poolworkload-chart-title">Свободно</div>

        {/* Область прокрутки графика */}
        <div ref={scrollRef} className="poolworkload-chart-scroll">
          <div
            className="poolworkload-chart-container"
            style={{ width: chartWidth, minWidth: chartWidth }}
          >
            {/* Шапка часов — в одну линию */}
            <div
              className="poolworkload-hours-row"
              style={{ paddingLeft: LEFT_PADDING, display: "flex", flexWrap: "nowrap" }}
            >
              {hours.map((h) => (
                <div
                  key={h}
                  className="poolworkload-hour-label"
                  style={{ minWidth: BAR_WIDTH, marginRight: BAR_GAP, whiteSpace: "nowrap", textAlign:"center", color:"#185a90", fontWeight:800 }}
                >
                  {String(h).padStart(2, "0")}:00
                </div>
              ))}
            </div>

            {/* Только выбранная дата */}
            {activeDate && (
              <div className="poolworkload-row" style={{ display: "flex", alignItems: "flex-end", paddingTop: TOP_PADDING }}>
                {/* Метка даты слева */}
                <div
                  className="poolworkload-date-left"
                  style={{
                    width: LEFT_PADDING - 4,
                    minWidth: LEFT_PADDING - 4,
                    textAlign: "left",
                    color: "#133d61",
                    fontWeight: 900,
                    marginRight: 4,
                    whiteSpace: "nowrap",
                    fontSize: 14,
                  }}
                >
                  {formatDateShortRu(activeDate)}
                </div>

                {/* Колонки по часам */}
                <div style={{ display: "flex", flexDirection: "row", alignItems: "flex-end" }}>
                  {hours.map((h) => {
                    const slot = byDateHour[activeDate]?.[h];
                    const br = isBreakHour(activeDate, h) || !!slot?.isBreak;
                    const freeLanes = br
                      ? 0
                      : Math.max(0, Math.min(TOTAL_LANES, slot?.freeLanes ?? 0));

                    // Сегменты: абсолютное позиционирование снизу вверх
                    const segs = [] as React.ReactElement[];
                    for (let i = 0; i < TOTAL_LANES; i++) {
                      const isFree = i < freeLanes;
                      const t =
                        freeLanes <= 1 ? 1 : (freeLanes - i) / freeLanes;
                      const bg = br
                        ? INACTIVE_COLOR
                        : isFree
                        ? lerpColor(COLOR_BOTTOM, COLOR_TOP, t)
                        : INACTIVE_COLOR;
                      const topPx =
                        (TOTAL_LANES - i - 1) * (SEGMENT_HEIGHT + SEGMENT_GAP);
                      segs.push(
                        <div
                          key={i}
                          className="poolworkload-seg"
                          style={{
                            position: "absolute",
                            left: 0,
                            right: 0,
                            top: topPx,
                            height: SEGMENT_HEIGHT,
                            background: bg,
                            borderRadius: 7,
                          }}
                        />
                      );
                    }

                    return (
                      <div
                        key={`${activeDate}_${h}`}
                        className="poolworkload-bar"
                        style={{
                          width: BAR_WIDTH,
                          marginRight: BAR_GAP,
                          display: "flex",
                          alignItems: "flex-end",
                          justifyContent: "center",
                        }}
                        onMouseEnter={(e) => {
                          cancelHide();
                          showPopupAtEl(
                            e.currentTarget as HTMLElement,
                            freeLanes,
                            h,
                            br
                          );
                        }}
                        onMouseLeave={hidePopupDelayed}
                        title={
                          br
                            ? "ПЕРЕРЫВ"
                            : `${freeLanes} дорожек • ${
                                freeLanes * LANE_CAPACITY
                              } мест`
                        }
                      >
                        <div
                          className="poolworkload-bar-inner"
                          style={{
                            position: "relative",
                            height: BAR_TOTAL_HEIGHT,
                            width: "100%",
                            borderRadius: 10,
                          }}
                        >
                          {segs}
                          {br && (
                            <div
                              className="poolworkload-break"
                              style={{
                                position: "absolute",
                                inset: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 12,
                                fontWeight: 900,
                                color: "#185a90",
                                background: "#f2f6fa",
                                borderRadius: 10,
                              }}
                            >
                              ПЕРЕРЫВ
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Попап */}
      {popup && (
        <div
          className="poolworkload-popup-wrapper"
          style={{
            left: popup.left,
            top: popup.top,
            opacity: popup.visible ? 1 : 0,
          }}
        >
          {!popup.isBreak ? (
            <div className="poolworkload-popup">
              <div className="poolworkload-popup-hour">
                {popup.hour}:00 — {popup.hour + 1}:00
              </div>
              <div className="poolworkload-popup-value">
                {popup.value}
                <span className="poolworkload-popup-unit">дорожек</span>
              </div>
              <div className="poolworkload-popup-desc">
                {popup.value * LANE_CAPACITY} мест
              </div>
              {/* Кнопка-заглушка брони, как просили ранее */}
              <button
                style={{
                  marginTop: 10,
                  width: "100%",
                  padding: "8px 0",
                  borderRadius: 9,
                  background: "#185a90",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 15,
                  border: "none",
                  cursor: "pointer",
                  pointerEvents: "auto",
                }}
                onClick={() => console.log("BOOK PLACEHOLDER", { date: activeDate, hour: popup.hour })}
              >
                Забронировать
              </button>
            </div>
          ) : (
            <div className="poolworkload-popup-break">ПЕРЕРЫВ</div>
          )}
          <div className="poolworkload-popup-arrow">
            <svg width={18} height={12} viewBox="0 0 18 12" fill="none">
              <path d="M0 0 Q9 16 18 0" fill="#fff" stroke="#eaf1f8" strokeWidth="1.5" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
};

export default PoolWorkload2Clone;