import React, { useEffect, useMemo, useState } from "react";
import { fetchPoolWorkload, PoolWorkloadSlot, PoolWorkloadResponse } from "@app1/api-client/poolWorkload";

const HOUR_START = 7;
const HOUR_END = 21;

function colorByFreeLanes(freeLanes?: number | null): string {
  if (freeLanes == null) return "#9aa9b7";
  if (freeLanes <= 0) return "#d73027";
  if (freeLanes <= 3) return "#fc8d59";
  if (freeLanes <= 6) return "#fee08b";
  if (freeLanes <= 8) return "#91cf60";
  return "#1a9850";
}

function formatDDMM(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => (n < 10 ? "0" + n : String(n));
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  slot?: PoolWorkloadSlot;
}

const PoolHistogram: React.FC = () => {
  const [slots, setSlots] = useState<PoolWorkloadSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0 });

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res: PoolWorkloadResponse = await fetchPoolWorkload({ start_hour: HOUR_START, end_hour: HOUR_END });
        setSlots(res.slots ?? []);
      } catch (e: any) {
        setError(e.message || "Ошибка загрузки");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const dates = useMemo(() => {
    const s = new Set<string>();
    slots.forEach((sl) => s.add(sl.date));
    return Array.from(s).sort();
  }, [slots]);

  const hours = useMemo(() => {
    const arr: number[] = [];
    for (let h = HOUR_START; h <= HOUR_END; h++) arr.push(h);
    return arr;
  }, []);

  const slotMap = useMemo(() => {
    const m = new Map<string, PoolWorkloadSlot>();
    for (const sl of slots) m.set(`${sl.date}|${sl.hour}`, sl);
    return m;
  }, [slots]);

  const onEnter = (e: React.MouseEvent, slot?: PoolWorkloadSlot) => {
    if (!slot) return;
    setTooltip({ visible: true, x: e.clientX + 14, y: e.clientY + 10, slot });
  };
  const onMove = (e: React.MouseEvent) => {
    setTooltip((t) => (t.visible ? { ...t, x: e.clientX + 14, y: e.clientY + 10 } : t));
  };
  const onLeave = () => setTooltip({ visible: false, x: 0, y: 0, slot: undefined });

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ textAlign: "center", color: "#185a90", margin: "4px 0 12px" }}>Загруженность тренировочного бассейна</h2>

      <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginBottom: 10 }}>
        {[
          { label: "0", val: 0 },
          { label: "1–3", val: 2 },
            { label: "4–6", val: 5 },
            { label: "7–8", val: 7 },
            { label: "9–10", val: 10 }
        ].map(i => (
          <div key={i.label} style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, color:"#4c6a8c" }}>
            <div style={{ width:16, height:12, background:colorByFreeLanes(i.val), borderRadius:3 }} />
            <span>свободных дорожек: {i.label}</span>
          </div>
        ))}
      </div>

      {loading && <div style={{ textAlign:"center", color:"#4c6a8c" }}>Загрузка…</div>}
      {error && <div style={{ textAlign:"center", color:"#c62828" }}>Ошибка: {error}</div>}

      {!loading && !error && dates.length > 0 && (
        <div style={{ width:"100%", overflowX:"auto" }}>
          <table style={{ borderCollapse:"separate", borderSpacing:6, margin:"10px 0" }}>
            <thead>
              <tr>
                <th style={{ position:"sticky", left:0, background:"#f5f8fb", padding:"6px 10px", borderRadius:8, textAlign:"left", fontWeight:700, color:"#185a90", minWidth:90 }}>Дата</th>
                {hours.map(h => (
                  <th key={h} style={{ background:"#f5f8fb", padding:"6px 10px", borderRadius:8, fontWeight:700, color:"#185a90", whiteSpace:"nowrap" }}>
                    {String(h).padStart(2,"0")}:00
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dates.map(d => (
                <tr key={d}>
                  <th style={{ position:"sticky", left:0, background:"#f5f8fb", padding:"6px 10px", borderRadius:8, textAlign:"left", fontWeight:700, color:"#185a90" }}>{formatDDMM(d)}</th>
                  {hours.map(h => {
                    const slot = slotMap.get(`${d}|${h}`);
                    const isBreak = slot?.isBreak;
                    const color = isBreak ? "#AAB7C4" : colorByFreeLanes(slot?.freeLanes);
                    return (
                      <td key={h} style={{ padding:0 }}>
                        <div
                          role="button"
                          aria-label={`Свободных дорожек: ${slot?.freeLanes ?? "нет данных"}`}
                          style={{
                              width:48,
                              height:36,
                              borderRadius:8,
                              background:color,
                              outline:"1px solid #ffffffaa",
                              cursor:"pointer",
                              opacity:isBreak?0.55:1,
                              transition:"transform 80ms"
                            }}
                          onMouseEnter={(e)=>onEnter(e,slot)}
                          onMouseMove={onMove}
                          onMouseLeave={onLeave}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tooltip.visible && tooltip.slot && (
        <div style={{
          position:"fixed",
          left:tooltip.x,
          top:tooltip.y,
          zIndex:1000,
          background:"rgba(0,0,0,0.85)",
          color:"#fff",
          padding:"8px 10px",
          borderRadius:8,
          fontSize:13,
          maxWidth:260,
          pointerEvents:"none",
          boxShadow:"0 6px 18px rgba(0,0,0,0.25)"
        }}>
          <div style={{ fontWeight:700, marginBottom:4 }}>
            {new Date(tooltip.slot.date).toLocaleDateString("ru-RU",{day:"2-digit",month:"2-digit"})} {String(tooltip.slot.hour).padStart(2,"0")}:00
          </div>
          <div>Свободных дорожек: <b>{tooltip.slot.freeLanes ?? "—"}</b>{tooltip.slot.totalLanes ? ` из ${tooltip.slot.totalLanes}` : ""}</div>
          <div>Свободных мест: <b>{tooltip.slot.freePlaces}</b>{tooltip.slot.totalPlaces ? ` из ${tooltip.slot.totalPlaces}` : ""}</div>
          {tooltip.slot.isBreak && <div style={{ marginTop:4, color:"#ffd54f" }}>Перерыв</div>}
        </div>
      )}
    </div>
  );
};

export default PoolHistogram;