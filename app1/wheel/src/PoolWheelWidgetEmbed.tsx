import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchPoolWorkload, PoolWorkloadSlot, PoolWorkloadResponse } from "@app1/api-client/poolWorkload";

/* ---------- Тема и размеры ---------- */
type EmbedMode = "minimal" | "compact";
const THEME_COMPACT = {
  COL_W: 100, GAP: 8, ITEM_H: 36, WINDOW_ROWS: 3,
  LABEL_FS: 15, LABEL_WEIGHT: 700, LABEL_H: 50, // 700!
  ITEM_FS: 20, ITEM_ACTIVE_FS: 32,
  HEADLINE_FS: 20, HEADLINE_WEIGHT: 700,       // 700!
  BREAK_FS: 19,
  CARD_PAD_V: 12, CARD_PAD_H: 10,
};
const THEME_NORMAL = {
  COL_W: 260, GAP: 32, ITEM_H: 60, WINDOW_ROWS: 4,
  LABEL_FS: 18, LABEL_WEIGHT: 700, LABEL_H: 56, // 700!
  ITEM_FS: 24, ITEM_ACTIVE_FS: 36,
  HEADLINE_FS: 30, HEADLINE_WEIGHT: 700,       // 700!
  BREAK_FS: 24,
  CARD_PAD_V: 20, CARD_PAD_H: 16,
};

/* ---------- Дата и локаль ---------- */
const HOUR_START = 7, HOUR_END = 21;
const allHours: number[] = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);
const WEEKDAYS_RU = ["ВОСКРЕСЕНЬЕ","ПОНЕДЕЛЬНИК","ВТОРНИК","СРЕДА","ЧЕТВЕРГ","ПЯТНИЦА","СУББОТА"];
const MONTHS_RU = ["ЯНВАРЯ","ФЕВРАЛЯ","МАРТА","АПРЕЛЯ","МАЯ","ИЮНЯ","ИЮЛЯ","АВГУСТА","СЕНТЯБРЯ","ОКТЯБРЯ","НОЯБРЯ"];
function pad2(n: number) { return n < 10 ? "0"+n : String(n); }
function formatHeaderDate(iso: string) { if (!iso) return ""; const d = new Date(iso); return `${WEEKDAYS_RU[d.getDay()]}, ${pad2(d.getDate())} ${MONTHS_RU[d.getMonth()]}`; }
function formatIsoToDDMM(iso: string) { if (!iso) return ""; const d = new Date(iso); return `${pad2(d.getDate())}.${pad2(d.getMonth()+1)}`; }
function isBreakHour(dateIso: string | undefined, hour: number) { if (!dateIso) return false; if (hour !== 12) return false; const dow = new Date(dateIso).getDay(); return dow >= 1 && dow <= 5; }

/* ---------- Конфиг из query ---------- */
function normalizeHexColor(c?: string | null): string | undefined { if (!c) return; let h = c.replace("#","").trim().toLowerCase(); if (!/^[0-9a-f]{3}([0-9a-f]{3})?$/.test(h)) return; if (h.length===3) h = h.split("").map(ch=>ch+ch).join(""); return "#"+h; }
function readEmbedConfig() {
  const sp = new URLSearchParams(window.location.search);
  const modeParam = sp.get("mode") || sp.get("layout"), bg = (sp.get("bg") || sp.get("background") || "").toLowerCase();
  const mode: EmbedMode = modeParam === "compact" ? "compact" : "minimal";
  const transparentBg = bg === "transparent" || bg === "none" || sp.get("noBg") === "1";
  const font = (sp.get("font") || "").toLowerCase();
  const panel = (sp.get("panel") ?? (mode === "compact" ? "1" : "0")) !== "0";
  const color = normalizeHexColor(sp.get("color") || sp.get("text")) || "#ffffff";
  return { mode, transparentBg, font, panel, color };
}
const EMBED = readEmbedConfig();

/* ---------- Wheel ---------- */
interface WheelProps {
  items: (string | number)[];
  activeIndex: number;
  onChange: (index: number) => void;
  ariaLabel?: string;
  disabledIndices?: Set<number>;
  breakIndices?: Set<number>;
  className?: string;
  itemHeight: number;
  windowRows: number;
  compact?: boolean;
  activeColor?: string;
  breakFontSize?: number;
}
const Wheel: React.FC<WheelProps> = ({
  items, activeIndex, onChange, ariaLabel, disabledIndices, breakIndices, className = "",
  itemHeight, windowRows, compact, activeColor = "#ffffff", breakFontSize
}) => {
  const innerRef = useRef<HTMLDivElement|null>(null), startYRef = useRef<number|null>(null), lastWheelTs = useRef(0);
  const itemH = itemHeight;
  const clamp = (i:number) => Math.max(0, Math.min(items.length - 1, i));
  const shift = (delta:number) => { if (!items.length) return; let next = clamp(activeIndex + delta); if (disabledIndices?.size) { while (disabledIndices.has(next) && next !== activeIndex) next = clamp(next + (delta > 0 ? 1 : -1)); } onChange(next); };

  useEffect(() => {
    const el = innerRef.current; if (!el) return;
    const onWheel = (e:WheelEvent) => { e.preventDefault(); const now = performance.now(); if (now - lastWheelTs.current < 70) return; lastWheelTs.current = now; shift(e.deltaY > 0 ? 1 : -1); };
    const onTouchStart = (e:TouchEvent) => { if (e.touches.length) startYRef.current = e.touches[0].clientY; };
    const onTouchMove = (e:TouchEvent) => { if (startYRef.current == null) return; const dy = e.touches[0].clientY - startYRef.current; if (Math.abs(dy) > 18) { e.preventDefault(); shift(dy < 0 ? 1 : -1); startYRef.current = e.touches[0].clientY; } };
    const onTouchEnd = () => { startYRef.current = null; };
    el.addEventListener("wheel", onWheel, { passive:false });
    el.addEventListener("touchstart", onTouchStart, { passive:false });
    el.addEventListener("touchmove", onTouchMove, { passive:false });
    el.addEventListener("touchend", onTouchEnd);
    return () => { el.removeEventListener("wheel", onWheel); el.removeEventListener("touchstart", onTouchStart); el.removeEventListener("touchmove", onTouchMove); el.removeEventListener("touchend", onTouchEnd); };
  }, [activeIndex, items.length, disabledIndices, onChange]);

  const translateY = (itemH * (windowRows/2)) - activeIndex * itemH, windowHeight = itemH * windowRows;
  return (
    <div className={"wheel-wrapper "+className+(compact ? " wheel-wrapper--compact": "")} aria-label={ariaLabel} style={{ height: windowHeight }}>
      <div className="wheel-inner" ref={innerRef} style={{ transform:`translateY(${translateY}px)` }}>
        {items.map((text, idx)=>{
          const active = idx === activeIndex, disabled = disabledIndices?.has(idx), isBreak = breakIndices?.has(idx);
          const itemStyle: React.CSSProperties = { height: itemH };
          if (active) { itemStyle.color = activeColor; itemStyle.opacity = 1; }
          if (isBreak && !active && breakFontSize) { itemStyle.fontSize = breakFontSize; }
          return (
            <div
              key={idx+String(text)}
              className={"wheel-item" + (active ? " wheel-item--active":"") + (disabled ? " wheel-item--disabled":"") + (isBreak ? " wheel-item--break":"")}
              onClick={()=>{ if(!disabled) onChange(idx); }}
              style={itemStyle}
            >{text}</div>
          );
        })}
      </div>
    </div>
  );
};

/* ---------- PoolWheelWidgetEmbed ---------- */
interface Props { onSelectSlot?: (dateIso: string, hour: number) => void; }
const PoolWheelWidgetEmbed: React.FC<Props> = () => {
  const [slots, setSlots] = useState<PoolWorkloadSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [dateIndex, setDateIndex] = useState(0);
  const [selectedHour, setSelectedHour] = useState<number|null>(null);

  // Локальный Bebas Neue с кириллицей (Regular 400 и Bold 700)
  const BEBAS_FACE = EMBED.font === "bebas" ? `
  @font-face {
    font-family: 'Bebas Neue';
    src: url('https://price.dvvs-ekb.ru/spt-priem/fonts/bebas-neue/BebasNeue-Regular.woff2') format('woff2');
    font-weight: 400;
    font-style: normal;
    font-display: swap;
  }
  @font-face {
    font-family: 'Bebas Neue';
    src: url('https://price.dvvs-ekb.ru/spt-priem/fonts/bebas-neue/BebasNeue Bold.woff') format('woff');
    font-weight: 700;
    font-style: normal;
    font-display: swap;
  }` : "";

  useEffect(()=> { fetchData(); /* eslint-disable-next-line */ }, []);
  const fetchData = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const res: PoolWorkloadResponse = await fetchPoolWorkload({});
      const loaded = res.slots || [];
      setSlots(loaded);
      if (!loaded.length) setSelectedHour(null);
    } catch (e:any) { setError(e.message || "Ошибка загрузки"); }
    finally { setLoading(false); }
  }, []);

  const dates = useMemo(()=>{ const uniq: string[] = []; for (const s of slots) if (!uniq.includes(s.date)) uniq.push(s.date); return uniq.sort(); }, [slots]);
  const currentDate = dates[dateIndex];

  const dateHoursSet = useMemo(()=>{ const set = new Set<number>(); slots.forEach(s=> { if (s.date === currentDate) set.add(s.hour); }); return set; }, [slots, currentDate]);

  useEffect(()=> {
    if (!currentDate || selectedHour == null) return;
    if (!dateHoursSet.has(selectedHour)) {
      const sorted = Array.from(dateHoursSet).sort((a,b)=>a-b);
      if (sorted.length) setSelectedHour(sorted[0]);
    }
  }, [currentDate, selectedHour, dateHoursSet]);

  const disabledIndices = useMemo(()=>{ const set = new Set<number>(); allHours.forEach((h, idx) => { if (!dateHoursSet.has(h)) set.add(idx); }); return set; }, [dateHoursSet]);
  const breakIndices = useMemo(()=>{ const set = new Set<number>(); if (currentDate) allHours.forEach((h, idx)=> { if (isBreakHour(currentDate, h)) set.add(idx); }); return set; }, [currentDate]);

  const hourIndex = allHours.indexOf(selectedHour ?? allHours[0]);
  const timeItems = useMemo(()=> allHours.map(h => currentDate && isBreakHour(currentDate, h) ? "перерыв" : `${pad2(h)}:00`), [currentDate]);
  const freePlacesItems = useMemo(()=> allHours.map(h => {
    if (!currentDate || isBreakHour(currentDate, h)) return 0;
    const sl = slots.find(s=> s.date === currentDate && s.hour === h);
    return sl?.freePlaces ?? 0;
  }), [slots, currentDate]);

  // авто-ресайз
  useEffect(() => {
    const post = () => { const h = document.documentElement.scrollHeight || document.body.scrollHeight || 0; window.parent?.postMessage({ type: "dvvs:wheels:height", height: h }, "*"); };
    post();
    const ro = new ResizeObserver(post);
    ro.observe(document.documentElement); ro.observe(document.body);
    const t = setInterval(post, 800);
    window.addEventListener("load", post);
    return () => { ro.disconnect(); window.removeEventListener("load", post); clearInterval(t); };
  }, []);

  const compact = EMBED.mode === "compact";
  const T = compact ? THEME_COMPACT : THEME_NORMAL;

  const styleVars: React.CSSProperties = EMBED.transparentBg ? ({
    ["--color-white" as any]: "transparent",
    ["--color-bg-page" as any]: "transparent",
    ["--theme-page-bg" as any]: "transparent",
    ["--color-primary" as any]: EMBED.color,
    ["--color-primary-strong" as any]: EMBED.color,
    ["--theme-color" as any]: EMBED.color
  } as React.CSSProperties) : ({
    ["--color-primary" as any]: EMBED.color,
    ["--color-primary-strong" as any]: EMBED.color,
    ["--theme-color" as any]: EMBED.color
  } as React.CSSProperties);

  const rowStyle: React.CSSProperties = { display:"flex", flexDirection:"row", flexWrap:"nowrap", gap:T.GAP, alignItems:"stretch", width:"100%", minWidth:0 };
  const cardStyle: React.CSSProperties = { flex:`0 0 ${T.COL_W}px`, width:T.COL_W, minWidth:T.COL_W, maxWidth:T.COL_W, padding: `${T.CARD_PAD_V}px ${T.CARD_PAD_H}px`, borderRadius: compact ? 20 : 40, background:"transparent", boxShadow:"none", display:"flex", flexDirection:"column", alignItems:"stretch" };
  const labelBase: React.CSSProperties = { color: EMBED.color, opacity:0.98, minHeight: T.LABEL_H, display:"flex", alignItems:"flex-end", fontWeight: T.LABEL_WEIGHT, fontSize: T.LABEL_FS, lineHeight: 1.05, whiteSpace:"normal" };

  const css = `
    ${BEBAS_FACE}
    html, body, #root, .pw-embed-root { background: transparent !important; }
    .pw-embed-root .pw-panel { background: transparent !important; box-shadow:none !important; border:0 !important; }
    .pw-embed-root .pw-wheel-card { background: transparent !important; box-shadow:none !important; border:0 !important; }
    .pw-embed-root .wheel-wrapper { -webkit-mask-image:none !important; mask-image:none !important; }
    .pw-embed-root .wheel-item { color: ${EMBED.color}CC !important; font-size: ${T.ITEM_FS}px !important; line-height: ${T.ITEM_H - 6}px !important; white-space: nowrap; }
    .pw-embed-root .wheel-item--active { color: ${EMBED.color} !important; opacity: 1 !important; font-size: ${T.ITEM_ACTIVE_FS}px !important; font-weight: 700 !important; }
    .pw-embed-root .wheel-item--break.wheel-item--active,
    .pw-embed-root .wheel-item--disabled.wheel-item--active { color: ${EMBED.color} !important; opacity: 1 !important; font-size: ${T.BREAK_FS}px !important; font-weight: 700 !important; }
    .pw-embed-root .wheel-item--break { color: ${EMBED.color}99 !important; font-size: ${T.BREAK_FS}px !important; font-family: 'Bebas Neue', Arial, sans-serif !important; font-weight: 700 !important; }
    .pw-embed-root .pw-headline { color: ${EMBED.color}; font-size: ${T.HEADLINE_FS}px; font-weight: ${T.HEADLINE_WEIGHT}; text-align: center; white-space: nowrap; margin: 0 0 ${compact ? 6 : 10}px 0; font-family: 'Bebas Neue', Arial, sans-serif !important; letter-spacing: .02em; }
    ${EMBED.font === "bebas" ? `
      .pw-embed-root .wheel-item,
      .pw-embed-root .pw-label,
      .pw-embed-root .pw-headline { font-family: 'Bebas Neue', Arial, sans-serif !important; letter-spacing: .02em; }
    ` : ""}
  `;

  const headerDate = currentDate ? formatHeaderDate(currentDate) : "";
  const headerTime = selectedHour != null ? `${pad2(selectedHour)}:00` : "";
  const headline = headerDate && headerTime ? `${headerDate} ${headerTime}` : (headerDate || headerTime);

  return (
    <>
      <style>{css}</style>
      <div className="pw-embed-root" style={styleVars}>
        <div className={EMBED.panel ? "pw-panel" : ""}>
          {headline && <div className="pw-headline">{headline}</div>}
          {loading && <div style={{ color:"#fff", textAlign:"center", padding:6, fontSize:12 }}>Загрузка…</div>}
          {error && <div style={{ color:"#fff", textAlign:"center", padding:6, fontSize:12 }}>Ошибка: {error}</div>}
          {!loading && !error && dates.length > 0 && currentDate && (
            <div className="pw-wheels-row" style={rowStyle}>
              <div className="pw-wheel-card" style={cardStyle}>
                <div className="pw-label" style={labelBase}>Дата</div>
                <Wheel items={dates.map(formatIsoToDDMM)} activeIndex={dateIndex} onChange={setDateIndex} ariaLabel="Дата"
                  itemHeight={T.ITEM_H} windowRows={T.WINDOW_ROWS} compact={compact} activeColor={EMBED.color} breakFontSize={T.BREAK_FS} />
              </div>
              <div className="pw-wheel-card" style={cardStyle}>
                <div className="pw-label" style={labelBase}>Время</div>
                <Wheel items={timeItems} activeIndex={hourIndex} onChange={(idx)=>setSelectedHour(allHours[idx])} ariaLabel="Время"
                  disabledIndices={disabledIndices} breakIndices={breakIndices}
                  itemHeight={T.ITEM_H} windowRows={T.WINDOW_ROWS} compact={compact} activeColor={EMBED.color} breakFontSize={T.BREAK_FS} />
              </div>
              <div className="pw-wheel-card" style={cardStyle}>
                <div className="pw-label" style={{...labelBase, lineHeight: 1.0}}>
                  <span>Свободно</span><br/><span>мест</span>
                </div>
                <Wheel items={freePlacesItems.map(v=>String(v))} activeIndex={hourIndex} onChange={()=>{}} ariaLabel="Свободно мест"
                  disabledIndices={disabledIndices} /* breakIndices не передаем */
                  itemHeight={T.ITEM_H} windowRows={T.WINDOW_ROWS} compact={compact} activeColor={EMBED.color} breakFontSize={T.BREAK_FS} />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default PoolWheelWidgetEmbed;