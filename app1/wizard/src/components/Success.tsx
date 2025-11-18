import React from "react";

export default function Success({ result, onClose }: { result: any; onClose: () => void }) {
  return (
    <div style={{ textAlign: "center", padding: 20 }}>
      <h2>Бронирование успешно</h2>
      <pre style={{ textAlign: "left", maxHeight: 240, overflow: "auto", background: "#f7f7f7", padding: 12 }}>{JSON.stringify(result, null, 2)}</pre>
      <div style={{ marginTop: 16 }}>
        <button onClick={onClose} className="primary">Закрыть</button>
      </div>
    </div>
  );
}