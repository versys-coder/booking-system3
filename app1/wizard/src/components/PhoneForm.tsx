import React, { useState } from "react";
import type { SelectedSlot } from "../WizardApp";

export default function PhoneForm({ slot, initialPhone, onBack, onSubmit }: {
  slot: SelectedSlot;
  initialPhone?: string;
  onBack: () => void;
  onSubmit: (phone: string) => void;
}) {
  const [phone, setPhone] = useState(initialPhone || "");
  const [error, setError] = useState<string | null>(null);

  function normalize(p: string) { return p.replace(/\D/g, ""); }

  function handleSend() {
    const norm = normalize(phone);
    if (!/^7?\d{10}$/.test(norm) && !/^\d{10}$/.test(norm)) {
      setError("Введите корректный номер (10-11 цифр)");
      return;
    }
    setError(null);
    onSubmit(norm);
  }

  return (
    <div style={{ textAlign: "center", padding: 12 }}>
      <div style={{ marginBottom: 10 }}>
        <button className="link" onClick={onBack}>← назад</button>
      </div>
      <h3>Подтверждение брони</h3>
      <div className="slot-line">Бронируем: {slot?.start_date}</div>
      <div style={{ marginTop: 12 }}>
        <input value={phone} onChange={(e)=>setPhone(e.target.value)} placeholder="+7 (___) ___-__-__" className="input" />
      </div>
      {error && <div className="error">{error}</div>}
      <div style={{ marginTop: 12 }}>
        <button className="primary" onClick={handleSend}>Отправить SMS</button>
      </div>
    </div>
  );
}