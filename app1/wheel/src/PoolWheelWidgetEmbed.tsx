import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchPoolWorkload, PoolWorkloadSlot, PoolWorkloadResponse } from "@app1/api-client/poolWorkload";

/**
 * Lightweight, self-contained PoolWheelWidgetEmbed with a Book button that:
 * - always shows when date+hour selected
 * - tries to open booking in the same iframe/window via relative URL (/pool-booking?start=...)
 * - if running embedded inside a parent page, sends postMessage({type:'dvvs:openBooking', payload}) so host can switch iframe src
 */

/* ---- theme & helpers (kept short) ---- */
const HOUR_START = 7, HOUR_END = 21;
const allHours: number[] = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);
function pad2(n:number){ return n < 10 ? "0"+n : String(n); }
function formatIsoToDDMM(iso?:string){ if(!iso) return ""; const d = new Date(iso); return `${pad2(d.getDate())}.${pad2(d.getMonth()+1)}`; }
function formatHeaderDate(iso?:string){ if(!iso) return ""; const d = new Date(iso); return d.toLocaleDateString("ru-RU", { weekday:"long", day:"2-digit", month:"long" }).toUpperCase(); }

/* --- SlotBookingButton --- */
function SlotBookingButton({ slot, label = "Забронировать" }: { slot: { start_date?:string, pool?:string }, label?:string }) {
  function buildHref(s:any){
    const q = new URLSearchParams();
    if (s.start_date) q.set("start", s.start_date);
    if (s.pool) q.set("pool", s.pool);
    // relative booking route — should be handled by booking app on the same origin (or by host listener)
    return `/pool-booking?${q.toString()}`;
  }

  function handleBooking(){
    const href = buildHref(slot);
    const payload = { start: slot.start_date, pool: slot.pool, href };

    // If embedded: ask parent to open booking (host should replace iframe.src or route)
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "dvvs:openBooking", payload }, "*");
        return;
      }
    } catch (e) { /* ignore */ }

    // Fallback: navigate in current window (works when wheel is served as a normal page or app)
    window.location.href = href;
  }

  return (
    <button type="button" onClick={handleBooking}
      className="wheel-book-btn"
      style={{
        background: "linear-gradient(90deg,#b95bf0,#6f73ff)", color:"#fff", border:0, borderRadius:28, padding:"12px 36px",
        fontWeight:700, fontSize:16, cursor:"pointer", boxShadow:"0 6px 18px rgba(0,0,0,0.12)"
      }}>
      {label}
    </button>
  );
}

/* --- Minimal Wheel (keeps the behavior from your version) --- */
interface WheelProps {
  items:(string|number)[];
  activeIndex:number;
  onChange:(i:number)=>void;
  ariaLabel?:string;
  disabledIndices?:Set<number>;
  breakIndices?:Set<number>;
  itemHeight:number;
  windowRows:number;
  activeColor?:string;
  breakFontSize?:number;
}
const Wheel: React.FC<WheelProps> = ({ items, activeIndex, onChange, ariaLabel, disabledIndices, breakIndices, itemHeight, windowRows, activeColor="#fff", breakFontSize })=>{
  const innerRef = useRef<HTMLDivElement|null>(null);
  const startY = useRef<number|null>(null);
  const lastWheelTs = useRef(0);
  const clamp = (i:number)=> Math.max(0, Math.min(items.length-1, i));
  const shift = (delta:number)=>{ if(!items.length) return; let next = clamp(activeIndex + delta); if(disabledIndices?.size){ while(disabledIndices.has(next) && next !== activeIndex) next = clamp(next + (delta>0?1:-1)); } onChange(next); };

  useEffect(()=>{
    const el = innerRef.current; if(!el) return;
    const onWheel = (e:WheelEvent)=>{ e.preventDefault(); const now = performance.now(); if(now - lastWheelTs.current < 70) return; lastWheelTs.current = now; shift(e.deltaY>0?1:-1); };
    const onTouchStart = (e:TouchEvent)=>{ if(e.touches.length) startY.current = e.touches[0].clientY; };
    const onTouchMove = (e:TouchEvent)=>{ if(startY.current==null) return; const dy = e.touches[0].clientY - startY.current; if(Math.abs(dy) > 18){ e.preventDefault(); shift(dy<0?1:-1); startY.current = e.touches[0].clientY; } };
    const onTouchEnd = ()=>{ startY.current = null; };
    el.addEventListener("wheel", onWheel, { passive:false });
    el.addEventListener("touchstart", onTouchStart, { passive:false });
    el.addEventListener("touchmove", onTouchMove, { passive:false });
    el.addEventListener("touchend", onTouchEnd);
    return ()=>{ el.removeEventListener("wheel", onWheel); el.removeEventListener("touchstart", onTouchStart); el.removeEventListener("touchmove", onTouchMove); el.removeEventListener("touchend", onTouchEnd); };
  }, [activeIndex, items.length, disabledIndices, onChange]);

  const translateY = (itemHeight * (windowRows/2)) - activeIndex * itemHeight;
  const windowHeight = itemHeight * windowRows;
  return (
    <div className={"wheel-wrapper"} aria-label={ariaLabel} style={{ height: windowHeight }}>
      <div className="wheel-inner" ref={innerRef} style={{ transform:`translateY(${translateY}px)` }}>
        {items.map((t, idx)=>{
          const active = idx === activeIndex, disabled = disabledIndices?.has(idx), isBreak = breakIndices?.has(idx);
          const itemStyle: React.CSSProperties = { height: itemHeight, color: active ? activeColor : undefined, opacity: active ? 1 : 0.6 };
          if (isBreak && !active && breakFontSize) itemStyle.fontSize = breakFontSize;
          return <div key={idx+String(t)} className={"wheel-item"+(active?" wheel-item--active":"")+(disabled?" wheel-item--disabled":"")+(isBreak?" wheel-item--break":"")} style={itemStyle} onClick={()=>{ if(!disabled) onChange(idx); }}>{t}</div>;
        })}
      </div>
    </div>
  );
};

/* ---------- PoolWheelWidgetEmbed ---------- */
const PoolWheelWidgetEmbed: React.FC = () => {
  const [slots, setSlots] = useState<PoolWorkloadSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [dateIndex, setDateIndex] = useState(0);
  const [selectedHour, setSelectedHour] = useState<number|null>(null);

  useEffect(()=>{ fetchData(); /* eslint-disable-next-line */ }, []);
  const fetchData = useCallback(async ()=>{
    try {
      setLoading(true); setError(null);
      const res: PoolWorkloadResponse = await fetchPoolWorkload({});
      const loaded = res.slots || [];
      setSlots(loaded);
      if(!loaded.length) setSelectedHour(null);
    } catch (e:any) { setError(e?.message || "Ошибка загрузки"); }
    finally { setLoading(false); }
  }, []);

  const dates = useMemo(()=>{ const uniq:string[] = []; for(const s of slots) if(!uniq.includes(s.date)) uniq.push(s.date); return uniq.sort(); }, [slots]);
  const currentDate = dates[dateIndex];

  const dateHoursSet = useMemo(()=>{ const set = new Set<number>(); slots.forEach(s=>{ if(s.date === currentDate) set.add(s.hour); }); return set; }, [slots, currentDate]);

  // auto-select: if currentDate changes and selectedHour is null -> pick first available or fallback
  useEffect(()=>{
    if(!currentDate) return;
    if(selectedHour != null) return;
    const avail = Array.from(dateHoursSet).sort((a,b)=>a-b);
    if(avail.length) setSelectedHour(avail[0]);
    else setSelectedHour(allHours[0]);
  }, [currentDate, dateHoursSet]);

  const disabledIndices = useMemo(()=>{ const s = new Set<number>(); allHours.forEach((h, idx)=>{ if(!dateHoursSet.has(h)) s.add(idx); }); return s; }, [dateHoursSet]);
  const breakIndices = useMemo(()=>{ const s = new Set<number>(); if(currentDate) allHours.forEach((h, idx)=>{ /* 12:00 break example */ if(h === 12) s.add(idx); }); return s; }, [currentDate]);

  const hourIndex = allHours.indexOf(selectedHour ?? allHours[0]);
  const timeItems = useMemo(()=> allHours.map(h => currentDate && (h===12) ? "перерыв" : `${pad2(h)}:00`), [currentDate]);
  const freePlacesItems = useMemo(()=> allHours.map(h => {
    if(!currentDate || h===12) return 0;
    const sl = slots.find(s=> s.date === currentDate && s.hour === h);
    return sl?.freePlaces ?? 0;
  }), [slots, currentDate]);

  // send height to parent
  useEffect(()=>{
    const post = ()=> { const h = document.documentElement.scrollHeight || document.body.scrollHeight || 0; try { parent.postMessage({ type:"dvvs:wheels:height", height:h }, "*"); } catch{} };
    post();
    const ro = new ResizeObserver(post);
    ro.observe(document.documentElement); ro.observe(document.body);
    const t = setInterval(post, 800);
    window.addEventListener("load", post);
    return ()=>{ ro.disconnect(); window.removeEventListener("load", post); clearInterval(t); };
  }, []);

  // css small inline for embed preview
  const css = `
    .pw-root { font-family: Inter, Arial, sans-serif; color: #fff; padding: 20px; }
    .pw-headline { text-align:center; font-weight:700; margin-bottom:18px; }
    .wheel-item { text-align:center; user-select:none; padding:6px 0; }
    .wheel-item--active { font-size:28px; font-weight:700; }
    .wheel-book-btn { border:0; }
  `;

  // DEBUG log
  // console.log("[PW]", { currentDate, selectedHour, datesLength: dates.length, slotsCount: slots.length });

  return (
    <>
      <style>{css}</style>
      <div className="pw-root">
        {currentDate && <div className="pw-headline">{formatHeaderDate(currentDate)}</div>}

        {loading && <div>Загрузка…</div>}
        {error && <div>Ошибка: {error}</div>}

        {!loading && !error && dates.length > 0 && currentDate && (
          <div style={{ display:"flex", gap:36, justifyContent:"center", alignItems:"flex-start" }}>
            <div>
              <div style={{ marginBottom:8, opacity:0.95 }}>Дата</div>
              <Wheel items={dates.map(formatIsoToDDMM)} activeIndex={dateIndex} onChange={setDateIndex} ariaLabel="Дата" itemHeight={48} windowRows={3} />
            </div>
            <div>
              <div style={{ marginBottom:8 }}>Время</div>
              <Wheel items={timeItems} activeIndex={hourIndex} onChange={(idx)=>setSelectedHour(allHours[idx])} ariaLabel="Время" itemHeight={48} windowRows={3} disabledIndices={disabledIndices} breakIndices={breakIndices} />
            </div>
            <div>
              <div style={{ marginBottom:8 }}>Свободно мест</div>
              <Wheel items={freePlacesItems.map(v=>String(v))} activeIndex={hourIndex} onChange={()=>{}} ariaLabel="Свободно" itemHeight={48} windowRows={3} disabledIndices={disabledIndices} />
            </div>
          </div>
        )}

        {/* fixed button — ensures visible in embed; you can change to non-fixed layout later */}
        {!loading && !error && currentDate && selectedHour != null && (
          <div style={{ display:"flex", justifyContent:"center", marginTop:28 }}>
            <SlotBookingButton slot={{ start_date: currentDate + "T" + pad2(selectedHour) + ":00:00", pool: "Тренировочный бассейн" }} />
          </div>
        )}
      </div>
    </>
  );
};

export default PoolWheelWidgetEmbed;