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
  const [, m, d] = iso.split("-");
  return `${Number(d)} ${MONTHS_RU[Number(m) - 1]}`;
}
function pad2(n: number) { return n < 10 ? "0"+n : String(n); }
function isBreakHour(dateIso: string | undefined, hour: number) {
  if (!dateIso) return false;
  if (hour !== 12) return false;
  const dow = new Date(dateIso).getDay();
  return dow >= 1 && dow <= 5;
}

/* ---------- Wheel: оригинальная динамика + центр 2*itemH ---------- */
interface WheelProps {
  items: string[];
  activeIndex: number;
  onChange: (index: number) => void;
  ariaLabel?: string;
  disabledIndices?: Set<number>;
  breakIndices?: Set<number>;
  className?: string;
}

const Wheel: React.FC<WheelProps> = ({
  items,
  activeIndex,
  onChange,
  ariaLabel,
  disabledIndices,
  breakIndices,
  className = "",
}) => {
  const wrapRef = useRef<HTMLDivElement|null>(null);
  const innerRef = useRef<HTMLDivElement|null>(null);
  const startYRef = useRef<number|null>(null);
  const lastWheelTs = useRef(0);

  const [itemH, setItemH] = useState<number>(60); // реальная высота строки

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

  // Измеряем высоту строки (DOM) для точного центрирования
  useEffect(() => {
    const measure = () => {
      const i = innerRef.current;
      if (!i) return;
      const firstChild = i.firstElementChild as HTMLElement | null;
      if (firstChild) {
        const h = firstChild.clientHeight || 60;
        if (h && h !== itemH) setItemH(h);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (innerRef.current) ro.observe(innerRef.current);
    const first = innerRef.current?.firstElementChild as HTMLElement | undefined;
    if (first) ro.observe(first);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [itemH, items.length]);

  // Оригинальная механика прокрутки
  useEffect(()=> {
    const el = innerRef.current;
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

  // Ключ: центр = 2*itemH (окно = 4 строки)
  const translateY = itemH * 2 - activeIndex * itemH;

  return (
    <div ref={wrapRef} className={"wheel-wrapper "+className} aria-label={ariaLabel}>
      <div
        className="wheel-inner"
        ref={innerRef}
        style={{ transform:`translateY(${translateY}px)` }}
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
    </div>
  );
};

/* ---------- Полный embed-виджет: Дата, Время, Свободно мест + кнопка ---------- */
interface Props { onSelectSlot?: (dateIso: string, hour: number) => void; }

const PoolWheelWidgetEmbed: React.FC<Props> = ({ onSelectSlot }) => {
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

  useEffect(()=> { fetchData(); /* eslint-disable-next-line */ }, []);

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
    if (!dateHoursSet.has(selectedHour)) {
      const sorted = Array.from(dateHoursSet).sort((a,b)=>a-b);
      if (sorted.length) setSelectedHour(sorted[0]);
    }
  }, [currentDate, selectedHour, dateHoursSet]);

  const disabledIndices = useMemo(()=>{
    const set = new Set<number>();
    allHours.forEach((h, idx) => {
      if (!dateHoursSet.has(h)) set.add(idx);
    });
    return set;
  }, [dateHoursSet]);

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

  const freePlacesItems = useMemo(()=> allHours.map(h => {
    if (!currentDate || isBreakHour(currentDate, h)) return 0;
    const sl = slots.find(s=> s.date === currentDate && s.hour === h);
    return sl?.freePlaces ?? 0;
  }), [slots, currentDate]);

  const handleDateChange = useCallback((idx:number)=> setDateIndex(idx), []);
  const handleHourChange = useCallback((idx:number)=> setSelectedHour(allHours[idx]), []);

  const handleBook = () => {
    if (!onSelectSlot || !activeSlot || selectedIsBreak) return;
    onSelectSlot(activeSlot.date, activeSlot.hour);
  };

  const canBook = Boolean(activeSlot && !selectedIsBreak);
  const hourIndex = allHours.indexOf(selectedHour ?? allHours[0]);

  // авто-ресайз для iframe
  useEffect(() => {
    const post = () => {
      const h =
        document.documentElement.scrollHeight ||
        document.body.scrollHeight ||
        0;
      window.parent?.postMessage({ type: "dvvs:wheels:height", height: h }, "*");
    };
    post();
    const ro = new ResizeObserver(post);
    ro.observe(document.documentElement);
    ro.observe(document.body);
    const t = setInterval(post, 600);
    window.addEventListener("load", post);
    return () => {
      ro.disconnect();
      window.removeEventListener("load", post);
      clearInterval(t);
    };
  }, []);

  return (
    <>
      <style>{`
        html, body { margin: 0; padding: 0; background: #0E3F72 !important; }
        .pw-embed-root { background: #0E3F72; min-height: 220px; color: #fff; }

        .pw-wheels-row {
          display: flex;
          gap: 36px;
          align-items: center;
          justify-content: center;
          margin: 8px auto 0 auto;
          padding: 8px 8px 28px 8px;
          box-sizing: border-box;
          width: 100%;
          max-width: 1300px;
          background: transparent;
        }
        .pw-wheel-card {
          width: 260px;
          min-width: 260px;
          background: transparent !important;
          border: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
        }

        /* окно колеса — 4 строки (как в оригинале), центр = 2*itemH */
        .wheel-wrapper {
          position: relative;
          width: 100%;
          height: 240px; /* 4 * 60px; если поменяете высоту строки — можно править здесь */
          overflow: hidden;
          background: transparent;
          touch-action: none;
        }
        .wheel-inner {
          transition: transform 0.3s cubic-bezier(.44,.13,.62,1.08);
          will-change: transform;
          width: 100%;
          touch-action: none;

          /* Затемнение сверху/снизу без белых артефактов */
          -webkit-mask-image: linear-gradient(
            to bottom,
            rgba(0,0,0,0) 0%,
            rgba(0,0,0,1) 18%,
            rgba(0,0,0,1) 82%,
            rgba(0,0,0,0) 100%
          );
          mask-image: linear-gradient(
            to bottom,
            rgba(0,0,0,0) 0%,
            rgba(0,0,0,1) 18%,
            rgba(0,0,0,1) 82%,
            rgba(0,0,0,0) 100%
          );
        }

        .wheel-item {
          width: 100%;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 30px;
          color: rgba(255,255,255,0.42);
          background: transparent;
          user-select: none;
          font-weight: 700;
          transition: color 160ms;
        }
        .wheel-item--active { color: #fff; font-weight: 900; }
        .wheel-item--disabled { opacity: 0.35; pointer-events: none; }
        .wheel-item--break { color: rgba(255,255,255,0.32); font-size: 18px; font-weight: 800; letter-spacing: .02em; }

        .pw-label-above {
          text-align: center;
          font-size: 18px;
          font-weight: 800;
          color: #fff;
          margin-bottom: 8px;
          letter-spacing: .02em;
        }

        .pw-book-btn {
          padding: 16px 32px;
          border-radius: 18px;
          background: #2F6FBF;
          color: #fff;
          border: none;
          font-weight: 900;
          font-size: 20px;
          cursor: pointer;
          margin-top: 18px;
          box-shadow: 0 0 36px rgba(47,111,191,.35);
        }
        .pw-book-btn:disabled { opacity: .5; cursor: not-allowed; }
      `}</style>

      <div className="pw-embed-root">
        {loading && <div style={{ color:"#fff", textAlign:"center", padding: 16 }}>Загрузка…</div>}
        {error && <div style={{ color:"#fff", textAlign:"center", padding: 16 }}>Ошибка: {error}</div>}
        {!loading && !error && dates.length > 0 && currentDate && (
          <div className="pw-wheels-row">
            {/* Дата */}
            <div className="pw-wheel-card">
              <Wheel
                items={dates.map(formatDateRuLong)}
                activeIndex={dateIndex}
                onChange={handleDateChange}
                ariaLabel="Дата"
              />
            </div>

            {/* Время */}
            <div className="pw-wheel-card">
              <Wheel
                items={timeItems}
                activeIndex={allHours.indexOf(selectedHour ?? allHours[0])}
                onChange={handleHourChange}
                ariaLabel="Время"
                disabledIndices={disabledIndices}
                breakIndices={breakIndices}
              />
            </div>

            {/* Свободно мест + кнопка */}
            <div className="pw-wheel-card">
              <div className="pw-label-above">Свободно мест</div>
              <Wheel
                items={freePlacesItems.map(v=>String(v))}
                activeIndex={allHours.indexOf(selectedHour ?? allHours[0])}
                onChange={() => {}}
                ariaLabel="Свободно мест"
                disabledIndices={disabledIndices}
                breakIndices={breakIndices}
              />
              <button
                className="pw-book-btn"
                disabled={!canBook}
                onClick={handleBook}
                title={selectedIsBreak ? "Перерыв" : (!activeSlot ? "Нет данных" : "")}
              >
                Забронировать
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default PoolWheelWidgetEmbed;