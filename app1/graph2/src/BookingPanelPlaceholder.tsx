import React from "react";

export default function BookingPanelPlaceholder() {
  return (
    <div style={{ width: "100%" }}>
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
        }}
      >
        Выберите удобное время слева.
      </div>
    </div>
  );
}