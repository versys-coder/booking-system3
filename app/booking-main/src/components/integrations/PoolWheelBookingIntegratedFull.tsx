import React from "react";
import PoolWheelWidget from "../PoolWheelWidget";
import QuickBookingFlow, { VirtualSlot } from "./QuickBookingFlow";

interface Props {
  onSelectSlot: (date: string, hour: number) => void;
  virtualSlot?: VirtualSlot | null;
  onReset?: () => void;
}

const WHEELS_WIDTH = 1100; // подбери под своё количество колес

const PoolWheelBookingIntegratedFull: React.FC<Props> = ({
  onSelectSlot,
  virtualSlot,
  onReset,
}) => {
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
      {/* Левый блок: фиксированная ширина по 4 колеса */}
      <div style={{ width: WHEELS_WIDTH, minWidth: 0 }}>
        <PoolWheelWidget onSelectSlot={onSelectSlot} />
      </div>

      {/* Правый блок: занимает остаток, embedded=true */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "flex-start" }}>
        <QuickBookingFlow
          virtualSlot={virtualSlot ?? null}
          onReset={onReset ?? (() => {})}
          hintWhenNoSlot="Выберите время колесом и нажмите 'Забронировать'"
          embedded={true}
        />
      </div>
    </div>
  );
};

export default PoolWheelBookingIntegratedFull;