import React, { useState } from "react";
import PoolWheelWidget from "/var/www/app/src/components/PoolWheelWidget";
import QuickBookingFlow, { VirtualSlot } from "/var/www/app/src/components/integrations/QuickBookingFlow";
import { useSlotsIndex } from "../Booking/useSlotsIndex";

const WHEELS_WIDTH = 1100;

const BookingVariantWheels: React.FC = () => {
  const [selected, setSelected] = useState<{ date: string; hour: number } | null>(null);
  const { resolveSlot } = useSlotsIndex();

  // Получаем слот с appointment_id/start_date, если выбран
  const virtualSlot: VirtualSlot | null = (() => {
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
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        gap: 32,
        alignItems: "flex-start",
        width: "100%",
        maxWidth: 1600,
        margin: "0 auto",
        boxSizing: "border-box",
      }}
    >
      {/* Левый блок: фиксированная ширина под 4 колеса */}
      <div style={{ width: WHEELS_WIDTH, minWidth: 0 }}>
        <PoolWheelWidget
          onSelectSlot={(date, hour) => setSelected({ date, hour })}
        />
      </div>

      {/* Правый блок: занимает остаток, embedded=true */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "flex-start" }}>
        <QuickBookingFlow
          virtualSlot={virtualSlot}
          onReset={() => setSelected(null)}
          hintWhenNoSlot="Выберите время колесом и нажмите 'Забронировать'"
          embedded={true}
        />
      </div>
    </div>
  );
};

export default BookingVariantWheels;