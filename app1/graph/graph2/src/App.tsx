import React from "react";
import PoolWorkload2Clone from "./PoolWorkload2Clone";
import BookingPanelPlaceholder from "./BookingPanelPlaceholder";

export default function App() {
  return (
    <div className="booking-variant booking-variant1-row">
      <div className="booking-variant1-chart">
        <PoolWorkload2Clone />
      </div>
      <div className="booking-variant1-side">
        <BookingPanelPlaceholder />
      </div>
    </div>
  );
}