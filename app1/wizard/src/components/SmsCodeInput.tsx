import React, { useEffect, useState } from "react";

/**
 * Заглушка/SmsForm упрощает ввод кода:
 * - Поддерживает onSuccess(clientData) и onBack()
 * - Если в URL ?pw_skip_sms=1 — автоматически вызывает onSuccess с тестовым client
 * - Показывает кнопку "Auto verify / Skip (debug)"
 *
 * Это не отправляет ничего на сервер — только вызывает колбэки, чтобы пройти flow.
 */

type Props = {
  phone?: string;
  onSuccess?: (clientData: any) => void;
  onBack?: () => void;
};

function readQueryFlag(name: string) {
  try {
    return new URLSearchParams(window.location.search).get(name) === "1";
  } catch {
    return false;
  }
}

export default function SmsForm({ phone, onSuccess, onBack }: Props) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const autoSkip = readQueryFlag("pw_skip_sms");

  useEffect(() => {
    if (autoSkip) {
      const t = setTimeout(() => {
        // fake client data
        onSuccess?.({ id: "debug-client", phone: phone ?? "70000000000" });
      }, 120);
      return () => clearTimeout(t);
    }
  }, []); // eslint-disable-line

  function verify() {
    // very permissive: accept any 3..8 digits
    if (!/^\d{3,8}$/.test(code)) {
      setError("Введите код из SMS или нажмите Skip");
      return;
    }
    setError(null);
    onSuccess?.({ id: "client-from-sms", phone: phone ?? "70000000000" });
  }

  return (
    <div style={{ textAlign: "center", padding: 12 }}>
      <div style={{ marginBottom: 10 }}>
        <button className="link" onClick={() => onBack?.()}>← назад</button>
      </div>

      <h3>Подтвердите код из SMS</h3>
      <div style={{ marginTop: 12 }}>
        <div>Номер: <b>{phone ?? "не указан"}</b></div>
      </div>

      <div style={{ marginTop: 12 }}>
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Код из SMS" className="input" />
      </div>

      {error && <div className="error">{error}</div>}

      <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "center" }}>
        <button className="primary" onClick={verify}>Проверить</button>
        <button className="secondary" onClick={() => onSuccess?.({ id: "debug-skip", phone: phone ?? "70000000000" })}>Auto verify / Skip (debug)</button>
      </div>

      <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
        Для отладки: добавьте в URL <code>?pw_skip_sms=1</code> чтобы автоматически пройти подтверждение.
      </div>
    </div>
  );
}