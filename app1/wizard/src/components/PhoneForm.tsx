import React, { useEffect, useState } from "react";
import "./styles.css";

type Slot = { appointment_id?: string; start_date?: string } | null;

type Props = {
  slot?: Slot;
  initialPhone?: string;
  onBack?: () => void;
  onSubmit?: (result: { phone: string; requestId: string }) => void;
};

function normalizePhone(raw: string): string {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  let d = digits;
  if (d.startsWith("8")) d = "7" + d.slice(1);
  if (d.length === 10 && d[0] === "9") d = "7" + d;
  return d;
}

function safeJson(text: string) {
  try { return text ? JSON.parse(text) : null; } catch { return null; }
}

/** Возвращает базовый префикс API, используемый в этом хосте.
 *  По умолчанию соответствует конфигу Apache: /catalog/api-backend/api
 *  Вы можете переопределить window.__PW_API_BASE__ при необходимости.
 */
function apiBase(): string {
  const g = (window as any).__PW_API_BASE__;
  if (g && typeof g === "string" && g.trim()) return g.replace(/\/+$/, "");
  return "/catalog/api-backend/api";
}

export default function PhoneForm({ slot = null, initialPhone = "", onBack, onSubmit }: Props) {
  const saved = typeof window !== "undefined" ? localStorage.getItem("pw:phone") || "" : "";
  const [phone, setPhone] = useState<string>(initialPhone || saved || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    if (initialPhone) setPhone(initialPhone);
  }, [initialPhone]);

  function formatSlot(s?: Slot) {
    if (!s?.start_date) return "Время не выбрано";
    try {
      const dt = new Date(s.start_date);
      if (isNaN(dt.getTime())) return s.start_date!;
      return dt.toLocaleString("ru-RU", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" });
    } catch {
      return s.start_date || "Время не выбрано";
    }
  }

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setHint(null);

    const norm = normalizePhone(phone);
    if (!/^7\d{10}$/.test(norm)) {
      setError("Неверный формат телефона. Ожидается 7XXXXXXXXXX.");
      return;
    }

    setLoading(true);
    try {
      const base = apiBase(); // <-- важное изменение: используем префикс, который проксируется на 5300
      const url = `${base}/confirm_phone`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: norm, method: "sms" }),
      });

      const text = await resp.text();
      const json = safeJson(text);

      if (!resp.ok) {
        const msg = (json && (json.error || json.message)) || text || resp.statusText;
        setError("Ошибка отправки SMS: " + msg);
        return;
      }

      try { localStorage.setItem("pw:phone", norm); } catch {}

      const requestId = json?.request_id || json?.requestId || json?.request || json?.rid || "";
      setHint("SMS отправлен. Введите код из SMS.");
      onSubmit?.({ phone: norm, requestId: String(requestId || "") });
    } catch (err: any) {
      setError("Сетевая ошибка: " + (err?.message || String(err)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="transparent-panel" style={{ maxWidth: 520, margin: "12px auto", textAlign: "center" }}>
      <div style={{ textAlign: "left" }}>
        <button className="link" onClick={onBack} style={{ marginBottom: 8 }}>← назад</button>
      </div>

      <h3 style={{ margin: "6px 0 10px" }}>Подтверждение брони</h3>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, opacity: 0.85 }}>Бронируем:</div>
        <div style={{ fontWeight: 700, marginTop: 6 }}>{formatSlot(slot)}</div>
      </div>

      <form onSubmit={handleSend} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input
          aria-label="phone"
          placeholder="+7 (912) 345-67-89"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={loading}
          style={{ padding: "12px 14px", borderRadius: 10, fontSize: 18, textAlign: "center", outline: "none" }}
        />

        {error && <div style={{ color: "#b91c1c" }}>{error}</div>}
        {hint && <div style={{ color: "#065f46" }}>{hint}</div>}

        <div style={{ display: "flex", justifyContent: "center", gap: 10 }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "11px 20px",
              borderRadius: 12,
              minWidth: 160,
              background: "linear-gradient(90deg,#6d5df6,#5db8ff)",
              color: "#fff",
              border: "none",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {loading ? "Отправка..." : "Получить SMS"}
          </button>

          <button
            type="button"
            onClick={() => {
              try { localStorage.setItem("pw:phone", normalizePhone(phone) || "70000000000"); } catch {}
              onSubmit?.({ phone: normalizePhone(phone) || "70000000000", requestId: "debug-skip" });
            }}
            style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.12)", background: "transparent", cursor: "pointer" }}
          >
            Skip
          </button>
        </div>
      </form>
    </div>
  );
}