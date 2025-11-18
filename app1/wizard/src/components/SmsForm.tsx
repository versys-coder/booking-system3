import React, { useState } from "react";
import SmsCodeInput from "./SmsCodeInput";
import type { SelectedSlot } from "../WizardApp";

/**
 * Minimal SMS form stub — replace calls with real API calls later.
 */

export default function SmsForm({ slot, phone, onBack, onComplete }: {
  slot: SelectedSlot;
  phone: string;
  onBack: () => void;
  onComplete: (res: any) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [helper, setHelper] = useState<string | undefined>(undefined);

  async function handleConfirm(code: string) {
    setLoading(true);
    setHelper(undefined);
    try {
      // simulate verification & booking; later call real bookingApi
      await new Promise((r) => setTimeout(r, 700));
      onComplete({ ok: true, slot, phone, code });
    } catch (e:any) {
      setHelper(e?.message || "Ошибка подтверждения");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ textAlign: "center", padding: 12 }}>
      <div style={{ marginBottom: 10 }}>
        <button className="link" onClick={onBack}>← назад</button>
      </div>
      <h3>Введите код из SMS</h3>
      <div style={{ marginTop: 8, marginBottom: 8 }}>Код отправлен на {phone}</div>
      <SmsCodeInput phone={phone} onComplete={handleConfirm} loading={loading} helper={helper} />
    </div>
  );
}