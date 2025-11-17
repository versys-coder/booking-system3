import React from "react";
import PoolWorkload1 from "./components/PoolWorkload1";

export default function App() {
  return (
    <div className="booking-variant booking-variant1-row">
      <div className="booking-variant1-chart">
        <PoolWorkload1 />
      </div>
      <div className="booking-variant1-side">
        <h3 style={{ color: "#185a90", fontWeight: 900, margin: "0 0 12px" }}>
          Бронирование
        </h3>
        <p style={{ color: "#406483", marginTop: 0 }}>
          Здесь будет форма бронирования. Пока заглушка.
        </p>
        <div
          style={{
            marginTop: 12,
            padding: "14px 12px",
            background: "#f5f8fb",
            borderRadius: 12,
            color: "#185a90",
            fontWeight: 700,
            width: "100%"
          }}
        >
          Выберите удобное время слева.
        </div>
      </div>
    </div>
  );
}