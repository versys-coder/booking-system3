import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchPoolWorkload,
  PoolWorkloadSlot,
  PoolWorkloadResponse,
} from "../api/poolWorkload";

/* ---------- Константы ---------- */
const HOUR_START = 7;
const HOUR_END = 21;
const allHours: number[] = Array.from(
  { length: HOUR_END - HOUR_START + 1 },
  (_, i) => HOUR_START + i
);

const MONTHS_RU = [
  "января","февраля","марта","апреля","мая","июня",
  "июля","августа","сентября","октября","ноября","декабря"
];
function formatDateRuLong(iso: string) {
  if (!iso) return "";
  const [ , m, d] = iso.split("-");
  return `${Number(d)} ${MONTHS_RU[Number(m) - 1]}`;
}
function pad2(n: number) { return n < 10 ? "0"+n : String(n); }
function isBreakHour(dateIso: string | undefined, hour: number) {
  if (!dateIso) return false;
  if (hour !== 12) return false;
  const dow = new Date(dateIso).getDay(); // 0=вс
  return dow >= 1 && dow <= 5;
}

/* ---------- Wheel ---------- */
interface WheelProps {
  items: string[];
  activeIndex: number;
  onChange: (index: number) => void;
  ariaLabel?: string;
  itemHeight?: number;
  disabledIndices?: Set<number>;
  breakIndices?: Set<number>;
  className?: string;
}

const Wheel: React.FC<WheelProps> = ({
  items,
  activeIndex,
  onChange,
  ariaLabel,
  itemHeight = 60,
  disabledIndices,
  breakIndices,
  className = "",
}) => {
  const ref = useRef<HTMLDivElement|null>(null);
  const startYRef = useRef<number|null>(null);
  const lastWheelTs = useRef(0);

  const clamp = (i:number) => Math.max(0, Math.min(items.length - 1, i));

  const shift = (delta:number) => {
    if (!items.length) return;
    let next = clamp(activeIndex + delta);
    if (disabledIndices?.size) {
      while (disabledIndices.has(next) && next !== activeIndex) {
        next = clamp(next + (delta > 0 ? 1 : -1));
      }
    }
    onChange(next);
  };

  useEffect(()=> {
    const el = ref.current;
    if (!el) return;

    const onWheel = (e:WheelEvent) => {
      e.preventDefault();
      const now = performance.now();
      if (now - lastWheelTs.current < 70) return;
      lastWheelTs.current = now;
      shift(e.deltaY > 0 ? 1 : -1);
    };
    const onTouchStart = (e:TouchEvent) => {
      if (!e.touches.length) return;
      startYRef.current = e.touches[0].clientY;
    };
    const onTouchMove = (e:TouchEvent) => {
      if (startYRef.current == null) return;
      const dy = e.touches[0].clientY - startYRef.current;
      if (Math.abs(dy) > 26) {
        e.preventDefault();
        shift(dy < 0 ? 1 : -1);
        startYRef.current = e.touches[0].clientY;
      }
    };
    const onTouchEnd = () => { startYRef.current = null; };

    el.addEventListener("wheel", onWheel, { passive:false });
    el.addEventListener("touchstart", onTouchStart, { passive:false });
    el.addEventListener("touchmove", onTouchMove, { passive:false });
    el.addEventListener("touchend", onTouchEnd);

    return ()=> {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [activeIndex, items.length, disabledIndices, onChange]);

  return (
    <div className={"wheel-wrapper "+className} aria-label={ariaLabel}>
      <div
        className="wheel-inner"
        ref={ref}
        style={{ transform:`translateY(${120 - activeIndex*itemHeight}px)` }}
      >
        {items.map((text, idx)=>{
          const active = idx === activeIndex;
          const disabled = disabledIndices?.has(idx);
          const isBreak = breakIndices?.has(idx);
          return (
            <div
              key={idx+text}
              className={
                "wheel-item" +
                (active ? " wheel-item--active":"") +
                (disabled ? " wheel-item--disabled":"") +
                (isBreak ? " wheel-item--break":"")
              }
              onClick={()=>{ if(!disabled) onChange(idx); }}
            >{text}</div>
          );
        })}
      </div>
      <div className="wheel-fade wheel-fade--top" />
      <div className="wheel-fade wheel-fade--bottom" />
    </div>
  );
};

/* ---------- Виджет ---------- */
interface PoolWheelWidgetProps {
  onSelectSlot?: (dateIso: string, hour: number) => void;
}

const PoolWheelWidget: React.FC<PoolWheelWidgetProps> = ({ onSelectSlot }) => {
  const [slots, setSlots] = useState<PoolWorkloadSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);

  const [dateIndex, setDateIndex] = useState(0);
  const [selectedHour, setSelectedHour] = useState<number|null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res: PoolWorkloadResponse = await fetchPoolWorkload({});
      const loaded = res.slots || [];
      setSlots(loaded);

      if (loaded.length) {
        if (selectedHour == null) {
          const first = loaded.map(s=>s.hour).sort((a,b)=>a-b)[0];
          setSelectedHour(first);
        }
      } else {
        if (selectedHour != null) setSelectedHour(null);
      }
    } catch (e:any) {
      setError(e.message || "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [selectedHour]);

  useEffect(()=> {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dates = useMemo(()=>{
    const uniq: string[] = [];
    for (const s of slots) if (!uniq.includes(s.date)) uniq.push(s.date);
    return uniq.sort();
  }, [slots]);

  const currentDate = dates[dateIndex];

  const dateHoursSet = useMemo(()=>{
    const set = new Set<number>();
    slots.forEach(s=> { if (s.date === currentDate) set.add(s.hour); });
    return set;
  }, [slots, currentDate]);

  useEffect(()=> {
    if (!currentDate || selectedHour == null) return;
    if (dateHoursSet.has(selectedHour)) return;
    const available = Array.from(dateHoursSet).sort((a,b)=>a-b);
    if (!available.length) return;
    let nearest = available[0];
    let minDiff = Math.abs(nearest - selectedHour);
    for (const h of available) {
      const d = Math.abs(h - selectedHour);
      if (d < minDiff) { minDiff = d; nearest = h; }
    }
    setSelectedHour(nearest);
  }, [currentDate, dateHoursSet, selectedHour]);

  const hourIndex = useMemo(()=>{
    if (selectedHour == null) return 0;
    const idx = allHours.indexOf(selectedHour);
    return idx >= 0 ? idx : 0;
  }, [selectedHour]);

  const disabledIndices = useMemo(()=>{
    const set = new Set<number>();
    if (!currentDate) {
      allHours.forEach((_, idx)=> set.add(idx));
      return set;
    }
    allHours.forEach((h, idx)=> {
      if (!dateHoursSet.has(h)) set.add(idx);
    });
    return set;
  }, [currentDate, dateHoursSet]);

  const breakIndices = useMemo(()=>{
    const set = new Set<number>();
    if (currentDate) {
      allHours.forEach((h, idx)=> {
        if (isBreakHour(currentDate, h)) set.add(idx);
      });
    }
    return set;
  }, [currentDate]);

  const activeSlot: PoolWorkloadSlot | undefined = useMemo(()=>{
    if (!currentDate || selectedHour == null) return undefined;
    return slots.find(s=> s.date === currentDate && s.hour === selectedHour);
  }, [slots, currentDate, selectedHour]);

  const selectedIsBreak =
    currentDate && selectedHour != null && isBreakHour(currentDate, selectedHour);

  const timeItems = useMemo(()=> allHours.map(h =>
    currentDate && isBreakHour(currentDate, h) ? "ПЕРЕРЫВ" : `${pad2(h)}:00`
  ), [currentDate]);

  const freeLanesItems = useMemo(()=> allHours.map(h => {
    if (!currentDate || isBreakHour(currentDate, h)) return 0;
    const sl = slots.find(s=> s.date === currentDate && s.hour === h);
    return sl?.freeLanes ?? 0;
  }), [slots, currentDate]);

  const freePlacesItems = useMemo(()=> allHours.map(h => {
    if (!currentDate || isBreakHour(currentDate, h)) return 0;
    const sl = slots.find(s=> s.date === currentDate && s.hour === h);
    return sl?.freePlaces ?? 0;
  }), [slots, currentDate]);

  const handleDateChange = useCallback((idx:number)=>{
    setDateIndex(idx);
  }, []);

  const handleHourChange = useCallback((idx:number)=>{
    setSelectedHour(allHours[idx]);
  }, []);

  const handleBook = () => {
    if (!onSelectSlot || !activeSlot || selectedIsBreak) return;
    onSelectSlot(activeSlot.date, activeSlot.hour);
  };

  const canBook = Boolean(onSelectSlot && activeSlot && !selectedIsBreak);

  return (
    <div className="pw-root" style={{ width: "100%", height: "100%", boxSizing: "border-box" }}>
      {loading && (
        <div className="pw-loader">
          <div className="pw-spinner" />
          <span>Загрузка...</span>
        </div>
      )}
      {error && <div className="pw-error">Ошибка: {error}</div>}
      {!loading && !error && !dates.length && (
        <div className="pw-empty">Нет данных</div>
      )}
      {!loading && !error && dates.length > 0 && currentDate && (
        <div className="pw-wheels-row">
          <div className="pw-wheel-card">
            <div className="pw-wheel-label">ДАТА</div>
            <Wheel
              items={dates.map(formatDateRuLong)}
              activeIndex={dateIndex}
              onChange={handleDateChange}
              ariaLabel="Дата"
            />
          </div>
          <div className="pw-wheel-card">
            <div className="pw-wheel-label">ВРЕМЯ</div>
            <Wheel
              items={timeItems}
              activeIndex={hourIndex}
              onChange={handleHourChange}
              ariaLabel="Время"
              disabledIndices={disabledIndices}
              breakIndices={breakIndices}
            />
          </div>
          <div className="pw-wheel-card">
            <div className="pw-wheel-label">СВОБОДНЫЕ ДОРОЖКИ</div>
            <Wheel
              items={freeLanesItems.map(v=>String(v))}
              activeIndex={hourIndex}
              onChange={() => {}}
              ariaLabel="Свободные дорожки"
              disabledIndices={disabledIndices}
              breakIndices={breakIndices}
            />
          </div>
          <div className="pw-wheel-card pw-wheel-card--places">
            <div className="pw-wheel-label">СВОБОДНО МЕСТ</div>
            <Wheel
              items={freePlacesItems.map(v=>String(v))}
              activeIndex={hourIndex}
              onChange={() => {}}
              ariaLabel="Свободно мест"
              disabledIndices={disabledIndices}
              breakIndices={breakIndices}
            />
            <div style={{ marginTop: 20, display: "flex", justifyContent: "center" }}>
              <button
                className="pw-book-btn pw-book-btn-inline"
                disabled={!canBook}
                onClick={handleBook}
                title={selectedIsBreak ? "Перерыв" : (!activeSlot ? "Нет данных" : "")}
                style={{
                  padding: "12px 32px",
                  borderRadius: 18,
                  background: canBook ? "#2c6d9f" : "#aacde2",
                  color: "#fff",
                  border: "none",
                  fontWeight: 800,
                  fontSize: 22,
                  cursor: canBook ? "pointer" : "default",
                  boxShadow: canBook ? "0 6px 18px rgba(44,109,159,0.18)" : "none"
                }}
              >
                Забронировать
              </button>
            </div>
            <div style={{ marginTop: 12, textAlign:"center" }}>
              <button
                style={{
                  fontSize:14,
                  background:"none",
                  border:"none",
                  color:"#2c6d9f",
                  cursor:"pointer",
                  fontWeight:600
                }}
                onClick={fetchData}
              >Обновить данные</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PoolWheelWidget;