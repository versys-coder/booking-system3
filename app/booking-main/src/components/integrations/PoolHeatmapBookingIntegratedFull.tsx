import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Интеграция Heatmap + бронирование, адаптированная под глобальные CSS-переменные темы.
 * Все цвета, размеры, шрифты и радиусы теперь берутся из var(--theme-...) или через глобальные палитры.
 */

const HOUR_START = 7;
const HOUR_END = 21;
const BREAK_HOUR = 12;
const LANE_CAPACITY = 12;
const TOTAL_LANES = 10;

interface SlotRaw {
  date: string;
  hour: number;
  freeLanes: number;
  freePlaces: number;
  isBreak?: boolean;
  current?: number | null;
  totalLanes?: number;
  totalPlaces?: number;
}

interface ApiResponse {
  slots: SlotRaw[];
  currentNow?: any;
  meta?: any;
}

interface Cell {
  date: string;
  hour: number;
  freeLanes: number;
  freePlaces: number;
  isBreak: boolean;
  current: number | null;
}

interface PopupState {
  x: number;
  y: number;
  date: string;
  hour: number;
  freeLanes: number;
  freePlaces: number;
  isBreak: boolean;
  current: number | null;
}

interface Props {
  onSelectSlot: (date: string, hour: number) => void;
}

function isBreak(dateIso: string, hour: number): boolean {
  if (hour !== BREAK_HOUR) return false;
  const d = new Date(dateIso).getDay();
  return d >= 1 && d <= 5;
}

function weekdayRu(d: string) {
  const names = ["Вс","Пн","Вт","Ср","Чт","Пт","Сб"];
  return names[new Date(d).getDay()];
}

function getVar(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name);
  return v?.trim() || fallback;
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

const PoolHeatmapBookingIntegratedFull: React.FC<Props> = ({ onSelectSlot }) => {
  const [rawSlots, setRawSlots] = useState<SlotRaw[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string|null>(null);
  const [popup, setPopup] = useState<PopupState | null>(null);
  const hideTimer = useRef<number| null>(null);

  // Тема: основные цвета и параметры из CSS-переменных
  const themeVars = {
    bg: getVar("--color-bg-section", "#f5fbff"),
    border: getVar("--color-bg-section", "#d7ecf8"),
    text: getVar("--theme-color", "#185a90"),
    emptyCell: "#eaf1f8",
    scaleFrom: "#99e8fa",
    scaleTo: getVar("--theme-color", "#185a90"),
    breakBg: "#f0f6fa"
  };

  useEffect(()=>{
    let cancelled = false;
    (async()=>{
      try {
        setLoading(true);
        const res = await fetch("/api/pool-workload?start_hour=7&end_hour=21");
        if (!res.ok) throw new Error(res.statusText);
        const data: ApiResponse = await res.json();
        if (!cancelled) {
          setRawSlots(data.slots || []);
        }
      } catch(e:any) {
        if (!cancelled) setErr(e?.message || "Ошибка загрузки");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return ()=>{ cancelled = true; };
    // eslint-disable-next-line
  },[]);

  const dates = useMemo(()=>{
    const s = new Set<string>();
    rawSlots.forEach(slt => s.add(slt.date));
    return Array.from(s).sort();
  }, [rawSlots]);

  const matrix: Record<string, Record<number, Cell>> = useMemo(()=>{
    const m: Record<string, Record<number, Cell>> = {};
    for (const r of rawSlots) {
      if (!m[r.date]) m[r.date] = {};
      const freeLanes = r.freeLanes ?? 0;
      const freePlaces = r.freePlaces ?? freeLanes * LANE_CAPACITY;
      const current = r.current ?? null;
      const ib = isBreak(r.date, r.hour);
      m[r.date][r.hour] = {
        date: r.date,
        hour: r.hour,
        freeLanes,
        freePlaces,
        isBreak: ib,
        current
      };
    }
    // гарантировать пустые ячейки (часы без данных)
    dates.forEach(d=>{
      for (let h=HOUR_START; h<=HOUR_END; h++) {
        if (!m[d]) m[d] = {};
        if (!m[d][h]) {
          m[d][h] = {
            date: d,
            hour: h,
            freeLanes: 0,
            freePlaces: 0,
            isBreak: isBreak(d,h),
            current: null
          };
        }
      }
    });
    return m;
  }, [rawSlots, dates]);

  // Максимум для цветовой шкалы (по свободным дорожкам)
  const maxFreeLanes = useMemo(()=>{
    let max = 0;
    rawSlots.forEach(r=>{
      max = Math.max(max, r.freeLanes ?? 0);
    });
    return Math.max(max, TOTAL_LANES);
  }, [rawSlots]);

  function colorForCell(c: Cell) {
    if (c.isBreak) return themeVars.breakBg;
    if (c.freeLanes <= 0) return themeVars.emptyCell;
    const t = Math.min(1, (c.freeLanes)/(maxFreeLanes || 1));
    return lerpColor(themeVars.scaleFrom, themeVars.scaleTo, t);
  }

  function handleEnter(e: React.MouseEvent, c: Cell) {
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setPopup({
      x: rect.left + rect.width/2,
      y: rect.top,
      date: c.date,
      hour: c.hour,
      freeLanes: c.freeLanes,
      freePlaces: c.freePlaces,
      isBreak: c.isBreak,
      current: c.current
    });
  }
  function scheduleHide() {
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(()=>setPopup(null), 250);
  }

  function cancelHide(){
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
  }

  return (
    <div style={{ position: "relative", fontFamily: "var(--theme-font-family)", color: "var(--theme-color)" }}>
      <div style={{ display:"flex", gap:18, flexWrap:"wrap", marginBottom:12 }}>
        {dates.map(d=>(
          <div key={d} style={{
            background:"var(--color-white)",
            padding:"8px 14px",
            borderRadius:"var(--theme-radius)",
            border:"1px solid #cfe8f7",
            fontWeight:700,
            color:"var(--theme-color)",
            fontSize:18
          }}>
            <div style={{ fontSize:14, fontWeight:800, opacity:.75 }}>{weekdayRu(d)}</div>
            {d}
          </div>
        ))}
      </div>
      <div style={{
        overflowX:"auto",
        border:"1px solid #e1f2fa",
        borderRadius:"var(--theme-radius)",
        background:themeVars.bg,
        padding:16,
        position:"relative"
      }}>
        <table style={{ borderCollapse:"separate", borderSpacing:4 }}>
          <thead>
            <tr>
              <th style={{ textAlign:"left", fontSize:14, color:"var(--theme-color)", fontWeight:800 }}>Дата / Час</th>
              {Array.from({length:HOUR_END-HOUR_START+1},(_,i)=>HOUR_START+i).map(h=>(
                <th key={h} style={{ fontSize:14, fontWeight:800, color:"var(--theme-color)", padding:"4px 6px" }}>{h}:00</th>
              ))}
            </tr>
          </thead>
          <tbody>
          {dates.map(d=>{
            return (
              <tr key={d}>
                <td style={{ fontWeight:700, fontSize:15, color:"var(--theme-color)" }}>{d}</td>
                {Array.from({length:HOUR_END-HOUR_START+1},(_,i)=>HOUR_START+i).map(h=>{
                  const c = matrix[d][h];
                  const bg = colorForCell(c);
                  return (
                    <td
                      key={h}
                      style={{
                        width:70,
                        height:46,
                        background:bg,
                        border:"1px solid "+themeVars.border,
                        borderRadius:"var(--theme-radius)",
                        position:"relative",
                        cursor: c.isBreak || c.freeLanes<=0 ? "default":"pointer",
                        boxShadow: c.isBreak ? "inset 0 0 0 2px #185a9033":"none"
                      }}
                      onMouseEnter={(e)=>handleEnter(e,c)}
                      onMouseLeave={scheduleHide}
                      onMouseMove={cancelHide}
                      onClick={()=>{ if(!c.isBreak && c.freeLanes>0) onSelectSlot(d,h); }}
                    >
                      {c.isBreak ? (
                        <div style={{ fontSize:11, fontWeight:800, color:"var(--theme-color)", textAlign:"center" }}>Перерыв</div>
                      ):(
                        <div style={{ textAlign:"center", fontSize:18, fontWeight:900, color:"var(--theme-color)" }}>
                          {c.freeLanes}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          </tbody>
        </table>
      </div>
      {popup && (
        <div
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
          style={{
            position:"fixed",
            left: popup.x - 110,
            top: popup.y - 130,
            width: 220,
            background:"var(--color-white)",
            border:"1px solid #eaf8ff",
            boxShadow:"0 3px 24px rgba(24,90,144,.16)",
            borderRadius:"var(--theme-radius)",
            padding:"16px 18px 14px",
            zIndex:500,
            color:"var(--theme-color)",
            fontWeight:600,
            fontFamily: "var(--theme-font-family)"
          }}
        >
          <div style={{ fontSize:16, fontWeight:900, marginBottom:4 }}>
            {popup.hour}:00–{popup.hour+1}:00
          </div>
          {popup.isBreak ? (
            <div style={{ fontSize:14, fontWeight:800 }}>ПЕРЕРЫВ</div>
          ):(
            <>
              <div style={{ fontSize:14, marginBottom:2 }}>
                Свободно дорожек: <b>{popup.freeLanes}</b>
              </div>
              <div style={{ fontSize:13, marginBottom:8 }}>
                Свободно мест: <b>{popup.freePlaces}</b>
              </div>
              <button
                style={{
                  width:"100%",
                  padding:"8px 10px",
                  borderRadius:"var(--theme-radius)",
                  background:"var(--theme-bg-active)",
                  color:"var(--theme-color-active)",
                  fontWeight:800,
                  border:"none",
                  cursor: popup.freeLanes>0 ? "pointer":"default",
                  opacity: popup.freeLanes>0 ? 1:.6,
                  fontFamily: "var(--theme-font-family)"
                }}
                disabled={popup.freeLanes<=0}
                onClick={()=>{ if (popup.freeLanes>0) onSelectSlot(popup.date, popup.hour); }}
              >Забронировать</button>
            </>
          )}
        </div>
      )}
      {loading && (
        <div style={{
          position:"absolute",
          inset:0,
          background:"rgba(255,255,255,.55)",
          display:"flex",
          alignItems:"center",
          justifyContent:"center",
          fontWeight:700,
          color:"var(--theme-color)",
          fontFamily: "var(--theme-font-family)"
        }}>
          Загрузка...
        </div>
      )}
      {err && (
        <div style={{
          marginTop:12,
          color:"#d32f2f",
          fontWeight:700
        }}>
          Ошибка: {err}
        </div>
      )}
    </div>
  );
};

export default PoolHeatmapBookingIntegratedFull;