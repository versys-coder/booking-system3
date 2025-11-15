import { useEffect, useMemo, useState } from "react";

/**
 * Упрощённый индекс слотов.
 * Предполагается:
 *  - В каждом часе только один слот (по требованию).
 *  - Слот длится ровно 60 минут, старт в целый час.
 */

export interface RawSlot {
  appointment_id: string;
  start_date: string; // "YYYY-MM-DD HH:MM:SS"
  service_id?: string;
  [k: string]: any;
}

export interface SlotsApiResponse {
  slots?: RawSlot[];
  [k: string]: any;
}

export interface SlotIndexEntry extends RawSlot {
  date: string;
  hour: number;
}

export interface UseSlotsIndexResult {
  loading: boolean;
  error: string | null;
  slots: RawSlot[];
  resolveSlot: (date: string, hour: number) => SlotIndexEntry | null;
}

export function useSlotsIndex(): UseSlotsIndexResult {
  const [slots, setSlots] = useState<RawSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);

  useEffect(()=>{
    let cancelled = false;
    (async()=>{
      try {
        setLoading(true);
        setError(null);
        const base = process.env.REACT_APP_BASE_API_URL || "";
        const url = `${base}/api/slots`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Slots request failed: ${res.status}`);
        const data: SlotsApiResponse = await res.json();
        if (!cancelled) {
          setSlots(data.slots || []);
        }
      } catch(e:any) {
        if (!cancelled) setError(e?.message || "Ошибка загрузки слотов");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return ()=>{ cancelled=true; };
  },[]);

  /**
   * Индекс: date -> hour -> slot
   */
  const index = useMemo(()=>{
    const m: Record<string, Record<number, RawSlot>> = {};
    for (const s of slots) {
      if (!s.start_date || !s.appointment_id) continue;
      const date = s.start_date.slice(0,10);
      const hour = Number(s.start_date.slice(11,13));
      if (!m[date]) m[date] = {};
      // Если вдруг придёт второй слот в этом часу — оставляем первый (по договорённости уникальность).
      if (!m[date][hour]) {
        m[date][hour] = s;
      }
    }
    return m;
  }, [slots]);

  function resolveSlot(date: string, hour: number): SlotIndexEntry | null {
    const raw = index[date]?.[hour];
    if (!raw) return null;
    return {
      ...raw,
      date,
      hour
    };
  }

  return { loading, error, slots, resolveSlot };
}