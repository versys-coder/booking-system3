import React, { useEffect, useMemo, useState } from "react";
import { fetchSlots as fetchSlotsLocal } from "../../api-client/src/bookingApi"; // local fallback API adapter
import "./styles/booking.css";

type SlotApi = {
  appointment_id?: string;
  start_date?: string; // "YYYY-MM-DD HH:MM:SS" or ISO
  service_id?: string;
  [k: string]: any;
};

interface Props {
  // optional pre-fetched data (if you already fetched slots in BookingApp)
  slotsByDate?: Record<string, SlotApi[]>;
  calendarDates?: string[]; // array of "YYYY-MM-DD" strings
  selectedSlot?: SlotApi | null;
  // callbacks
  setSelectedSlot?: (s: SlotApi | null) => void;
  onSelect?: (s: SlotApi) => void; // called when user selects a time
  onBook?: (s: SlotApi) => void; // called when user presses "Забронировать"
  // service id can be provided to fetch slots locally
  serviceId?: string;
}

/**
 * SlotPicker
 * - Minimal, self-contained slot picker adapted from app.
 * - Shows dates (calendarDates) and times for selected date.
 * - If slotsByDate not provided, will fetch using fetchSlotsLocal(serviceId).
 */
export default function SlotPicker({
  slotsByDate: slotsByDateProp,
  calendarDates: calendarDatesProp,
  selectedSlot,
  setSelectedSlot,
  onSelect,
  onBook,
  serviceId,
}: Props) {
  const [loading, setLoading] = useState<boolean>(false);
  const [slotsByDate, setSlotsByDate] = useState<Record<string, SlotApi[]>>(
    slotsByDateProp || {}
  );
  const [calendarDates, setCalendarDates] = useState<string[]>(
    calendarDatesProp || []
  );
  const [currentDateIdx, setCurrentDateIdx] = useState<number>(0);
  const [localSelected, setLocalSelected] = useState<SlotApi | null>(
    selectedSlot || null
  );

  useEffect(() => {
    if (slotsByDateProp) setSlotsByDate(slotsByDateProp);
  }, [slotsByDateProp]);

  useEffect(() => {
    if (calendarDatesProp) setCalendarDates(calendarDatesProp);
  }, [calendarDatesProp]);

  useEffect(() => {
    // if no data provided, fetch default slots (today..+6)
    let mounted = true;
    async function load() {
      if (slotsByDateProp && calendarDatesProp) return;
      setLoading(true);
      try {
        // fetchSlotsLocal returns structure depending on your backend.
        // Here we assume array of slots; adapt if your API returns different shape.
        const res: any = await fetchSlotsLocal(serviceId);
        // Normalize to slotsByDate: group slots by date string "YYYY-MM-DD"
        const slotsArr: SlotApi[] = Array.isArray(res) ? res : res?.data || [];
        const grouped: Record<string, SlotApi[]> = {};
        slotsArr.forEach((s) => {
          const sd = s.start_date || s.start || "";
          let d = sd.split("T")[0];
          if (!d && sd.indexOf(" ") !== -1) d = sd.split(" ")[0];
          if (!d) d = new Date().toISOString().slice(0, 10);
          if (!grouped[d]) grouped[d] = [];
          grouped[d].push(s);
        });
        if (!mounted) return;
        const dates = Object.keys(grouped).sort();
        setSlotsByDate(grouped);
        setCalendarDates(dates);
        setCurrentDateIdx(0);
      } catch (err) {
        // ignore silently; UI will show empty state
        console.warn("SlotPicker: fetchSlots failed", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [slotsByDateProp, calendarDatesProp, serviceId]);

  useEffect(() => {
    // keep localSelected synced with external selectedSlot
    setLocalSelected(selectedSlot || null);
  }, [selectedSlot]);

  const currentDate = calendarDates[currentDateIdx] || null;
  const timesForDate = useMemo(() => {
    if (!currentDate) return [];
    return (slotsByDate[currentDate] || []).slice().sort((a, b) => {
      const ta = (a.start_date || a.start || "").replace(" ", "T");
      const tb = (b.start_date || b.start || "").replace(" ", "T");
      return new Date(ta).getTime() - new Date(tb).getTime();
    });
  }, [slotsByDate, currentDate]);

  function handleSelect(slot: SlotApi) {
    setLocalSelected(slot);
    if (setSelectedSlot) setSelectedSlot(slot);
    if (onSelect) onSelect(slot);
  }

  function handleBookClick() {
    if (!localSelected) return;
    if (onBook) onBook(localSelected);
    else if (onSelect) onSelect(localSelected);
  }

  return (
    <div className="quick-booking-root">
      <h3 className="quick-booking-title">Быстрое бронирование</h3>

      {loading && <div className="quick-booking-noslot">Загрузка слотов…</div>}

      {!loading && calendarDates.length === 0 && (
        <div className="quick-booking-noslot">Слоты недоступны</div>
      )}

      {!loading && calendarDates.length > 0 && (
        <>
          <div className="booking-dates-row" style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 10 }}>
            {calendarDates.map((d, idx) => (
              <button
                key={d}
                className={`booking-date-button ${idx === currentDateIdx ? "active" : ""}`}
                onClick={() => setCurrentDateIdx(idx)}
                type="button"
              >
                <div style={{ fontSize: 12 }}>{new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" })}</div>
              </button>
            ))}
          </div>

          <div className="booking-times-grid" style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
            {timesForDate.length === 0 && <div className="quick-booking-noslot">Нет доступных часов</div>}
            {timesForDate.map((slot) => {
              const sd = (slot.start_date || slot.start || "").replace(" ", "T");
              const label = sd ? new Date(sd).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "—";
              const active = localSelected && (localSelected.appointment_id || localSelected.start_date) === (slot.appointment_id || slot.start_date);
              return (
                <button
                  key={slot.appointment_id || slot.start_date || label}
                  className={`booking-time-button ${active ? "active" : ""}`}
                  onClick={() => handleSelect(slot)}
                  type="button"
                  style={{ minWidth: 90 }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
            <button className="button-primary" onClick={handleBookClick} type="button" disabled={!localSelected}>
              Забронировать
            </button>
          </div>
        </>
      )}
    </div>
  );
}