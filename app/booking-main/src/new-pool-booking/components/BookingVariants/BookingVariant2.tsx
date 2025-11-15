import React, { useState } from "react";
import "./BookingVariant1.css";
import PoolWorkload2 from "./PoolWorkload2";
import QuickBookingFlow from "../Booking/QuickBookingFlow";
import { useSlotsIndex } from "../Booking/useSlotsIndex";

const BookingVariant2: React.FC = () => {
  const [selected, setSelected] = useState<{ date: string; hour: number } | null>(null);
  const { resolveSlot } = useSlotsIndex();

  // Получаем слот с appointment_id/start_date, если выбран
  const virtualSlot = (() => {
    if (!selected) return null;
    const slot = resolveSlot(selected.date, selected.hour);
    if (!slot) return null;
    return {
      appointment_id: slot.appointment_id,
      start_date: slot.start_date,
      date: selected.date,
      hour: selected.hour,
    };
  })();

  return (
    <div className="booking-variant1-row">
      <div className="booking-variant1-chart">
        <PoolWorkload2
          onBook={(date: string, hour: number) => setSelected({ date, hour })}
        />
      </div>
      <div className="booking-variant1-side">
        <QuickBookingFlow
          virtualSlot={virtualSlot}
          onReset={() => setSelected(null)}
        />
      </div>
    </div>
  );
};

export default BookingVariant2;