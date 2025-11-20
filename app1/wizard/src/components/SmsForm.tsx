import React, { useCallback, useEffect, useMemo, useState } from "react";

type SelectedSlot = {
  start_date?: string;
  appointment_id?: string;
  [k: string]: any;
};

type Props = {
  slot?: SelectedSlot | null;
  phone: string;
  requestId?: string;
  confirmDelayMs?: number; // minimal delay between resend attempts (ms)
  onBack?: () => void;
  onComplete?: (result: any) => void;
};

const apiBase = () => (window as any).__PW_API_BASE__ || "/catalog/api-backend/api";

export default function SmsForm({ slot, phone, requestId = "", confirmDelayMs = 800, onBack, onComplete }: Props) {
  const [code, setCode] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState<number>(0);

  const appointmentIdFromSlot = useMemo(() => slot?.appointment_id || null, [slot]);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const t = setTimeout(() => setResendCountdown((s) => Math.max(0, s - 100)), 100);
    return () => clearTimeout(t);
  }, [resendCountdown]);

  // probe backend /slots to find appointment_id based on slot or selectedStart
  async function probeAndFindAppointmentId(slotParam?: SelectedSlot | null): Promise<string | null> {
    try {
      const base = apiBase();
      const startRaw = slotParam?.start_date || (() => { try { return localStorage.getItem('pw:selectedStart'); } catch { return null; } })();
      if (!startRaw) return null;
      const dateOnly = (startRaw.indexOf('T') !== -1 ? startRaw.split('T')[0] : (startRaw.split(' ')[0] || startRaw)).slice(0, 10);

      const fetchSlots = async (s: string, e: string) => {
        const url = `${base}/slots?start_date=${encodeURIComponent(s)}&end_date=${encodeURIComponent(e)}`;
        const r = await fetch(url, { headers: { Accept: "application/json" } });
        const txt = await r.text();
        let parsed: any = null;
        try { parsed = txt ? JSON.parse(txt) : null; } catch { parsed = null; }
        const arr = Array.isArray(parsed?.slots) ? parsed.slots : (Array.isArray(parsed) ? parsed : (parsed?.data || []));
        try { (window as any).__PW_LAST_SLOTS_PROBE__ = { url, status: r.status, raw: txt?.slice(0, 5000) }; } catch (e) {}
        return Array.isArray(arr) ? arr : [];
      };

      let backendSlots = await fetchSlots(dateOnly, dateOnly);
      if (!backendSlots.length) {
        const d = new Date(dateOnly);
        const a = new Date(d); a.setDate(d.getDate() - 2);
        const b = new Date(d); b.setDate(d.getDate() + 2);
        backendSlots = await fetchSlots(a.toISOString().slice(0, 10), b.toISOString().slice(0, 10));
      }
      if (!backendSlots.length) return null;

      const targetStart = slotParam?.start_date || (localStorage.getItem('pw:selectedStart') || "");
      const targetHour = (() => {
        if (!targetStart) return undefined;
        const m = targetStart.match(/T?(\d{2}):(\d{2})/);
        return m ? Number(m[1]) : undefined;
      })();

      for (const b of backendSlots) {
        const sd = b.start_date || b.start || "";
        const d = sd.split(/[T\s]/)[0] || "";
        if (targetStart && (sd === targetStart || (targetStart.indexOf('T') === -1 && d === targetStart.split('T')[0]))) {
          if (b.appointment_id || b.id) return String(b.appointment_id || b.id);
        }
        if (targetHour != null) {
          const hm = sd.match(/T?(\d{2}):(\d{2})/);
          if (hm && Number(hm[1]) === targetHour && (b.appointment_id || b.id)) return String(b.appointment_id || b.id);
        }
      }
      return null;
    } catch (e) {
      console.warn('probeAndFindAppointmentId failed', e);
      return null;
    }
  }

  // helper to call backend confirm_phone with code
  const submitCode = useCallback(async () => {
    setError(null);
    setInfo(null);

    if (!phone) {
      setError("Не указан телефон.");
      return;
    }
    if (!code || code.trim().length < 2) {
      setError("Введите код подтверждения.");
      return;
    }

    setLoading(true);
    try {
      const base = apiBase();
      const payload: any = {
        phone,
        confirmation_code: code.trim(),
        request_id: requestId || "",
        method: "sms",
      };
      const resp = await fetch(`${base}/confirm_phone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const text = await resp.text();
      let data: any;
      try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }

      if (!resp.ok) {
        setError(`Ошибка подтверждения: ${resp.status} ${JSON.stringify(data).slice(0,500)}`);
        return;
      }

      const passToken = data?.data?.pass_token || data?.pass_token || data?.data?.passToken || data?.passToken || data?.passToken;
      if (!passToken) {
        try { localStorage.setItem("pw:confirmResponse", JSON.stringify(data)); } catch { /* ignore */ }
        setInfo("Код подтверждён, но токен не получен. Попробуйте отправить бронь вручную.");
      } else {
        try { localStorage.setItem("pw:passToken", passToken); } catch {}
        setInfo("Код подтверждён. Токен сохранён.");
      }

      // attempt booking automatically
      await doBooking(passToken);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [phone, code, requestId, slot]);

  // resend confirmation (ask server to send SMS again)
  const resend = useCallback(async () => {
    setError(null);
    setInfo(null);
    setResendLoading(true);

    try {
      const base = apiBase();
      const payload: any = { phone, method: "sms" };
      const resp = await fetch(`${base}/confirm_phone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const text = await resp.text();
      let data: any;
      try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }

      if (!resp.ok) {
        setError(`Ошибка повторной отправки: ${resp.status}`);
        return;
      }

      try {
        if (data?.data?.request_id) localStorage.setItem("pw:confirmRequestId", data.data.request_id);
        else if (data?.request_id) localStorage.setItem("pw:confirmRequestId", data.request_id);
      } catch (e) {}

      setInfo("Код выслан повторно.");
      setResendCountdown(confirmDelayMs || 800);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setResendLoading(false);
    }
  }, [phone, confirmDelayMs]);

  // booking: send appointment_id + usertoken to backend /book
  const doBooking = useCallback(async (maybeToken?: string | null) => {
    setError(null);
    setInfo(null);

    let appointmentId = appointmentIdFromSlot || null;
    if (!appointmentId) {
      try { appointmentId = localStorage.getItem("pw:selectedAppointmentId") || null; } catch {}
    }

    let usertoken = maybeToken || null;
    if (!usertoken) {
      try { usertoken = localStorage.getItem("pw:passToken") || localStorage.getItem("pw:pass_token") || null; } catch {}
    }

    if (!appointmentId) {
      const found = await probeAndFindAppointmentId(slot);
      if (found) {
        appointmentId = found;
        try { localStorage.setItem('pw:selectedAppointmentId', found); } catch {}
      }
    }

    if (!appointmentId) {
      setError("Не найден ID занятия. Пожалуйста, вернитесь к выбору слота и нажмите «Забронировать» ещё раз.");
      return null;
    }
    if (!usertoken) {
      setError("Не найден токен пользователя (passToken). Повторите подтверждение кода.");
      return null;
    }

    setLoading(true);
    try {
      console.info('[SmsForm] booking payload', { appointmentId, usertoken });
      const base = apiBase();
      const resp = await fetch(`${base}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointment_id: appointmentId, usertoken }),
      });
      const text = await resp.text();
      let data: any;
      try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }

      if (!resp.ok) {
        const msg = `Ошибка бронирования: ${resp.status} ${JSON.stringify(data).slice(0,800)}`;
        setError(msg);
        return { ok: false, status: resp.status, data };
      }

      try { localStorage.setItem("pw:lastBookingResponse", JSON.stringify(data)); } catch {}
      setInfo("Бронирование выполнено успешно.");
      if (typeof onComplete === "function") onComplete(data);
      return { ok: true, status: resp.status, data };
    } catch (e: any) {
      setError(String(e?.message || e));
      return { ok: false, error: e };
    } finally {
      setLoading(false);
    }
  }, [appointmentIdFromSlot, onComplete, slot]);

  const disabledSubmit = loading || !code || code.trim().length < 2;
  const disabledResend = resendLoading || resendCountdown > 0;

  const containerStyle: React.CSSProperties = { maxWidth: 720, margin: "18px auto", padding: 12, display: 'flex', justifyContent: 'center' };
  const cardStyle: React.CSSProperties = { width: '100%', background: '#ffffff', color: '#0b1320', borderRadius: 12, padding: 20, boxShadow: '0 8px 24px rgba(3,7,18,0.08)', border: '1px solid rgba(11,19,32,0.04)' };
  const titleStyle: React.CSSProperties = { marginTop: 0, marginBottom: 12, fontSize: 22, fontWeight: 700, color: '#0b1320' };
  const smallMuted: React.CSSProperties = { color: '#6b7280', fontSize: 13 };
  const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 12px", fontSize: 16, borderRadius: 8, border: "1px solid #e6e9ef", boxShadow: 'none' };
  const primaryBtn: React.CSSProperties = { padding: "10px 16px", borderRadius: 10, background: "#0b5cff", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700 };
  const secondaryBtn: React.CSSProperties = { padding: "10px 12px", borderRadius: 10, background: "transparent", border: "1px solid #e6e9ef", cursor: "pointer" };
  const dangerText: React.CSSProperties = { color: "#b91c1c", marginTop: 8 };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h2 style={titleStyle}>Подтверждение по SMS</h2>

        <div style={{ marginBottom: 10 }}>
          <div style={smallMuted}>Мы отправили код на телефон:</div>
          <div style={{ fontWeight: 700, fontSize: 18, marginTop: 6 }}>{phone || "—"}</div>
        </div>

        <div style={{ marginBottom: 8 }}>
          <label style={{ display: "block", marginBottom: 6, color: '#0b1320' }}>Код из SMS</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, "").slice(0, 10))}
            placeholder="Введите код"
            inputMode="numeric"
            style={inputStyle}
          />
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <button
            onClick={() => submitCode()}
            disabled={disabledSubmit}
            style={{
              ...primaryBtn,
              opacity: disabledSubmit ? 0.6 : 1,
              cursor: disabledSubmit ? "not-allowed" : "pointer",
            }}
          >
            Подтвердить и забронировать
          </button>

          <button
            onClick={() => { if (typeof onBack === "function") onBack(); }}
            style={secondaryBtn}
          >
            Назад
          </button>

          <button
            onClick={() => resend()}
            disabled={disabledResend}
            style={{
              marginLeft: "auto",
              padding: "8px 12px",
              borderRadius: 10,
              background: disabledResend ? "#f1f5f9" : "transparent",
              border: "1px dashed #cbd5e1",
              cursor: disabledResend ? "not-allowed" : "pointer",
            }}
          >
            {resendCountdown > 0 ? `Повторная отправка (${Math.ceil(resendCountdown/1000)}s)` : "Выслать код ещё раз"}
          </button>
        </div>

        {loading && <div style={{ marginBottom: 8 }}>Выполняется…</div>}
        {resendLoading && <div style={{ marginBottom: 8 }}>Отправляем код…</div>}
        {error && <div style={dangerText}>{error}</div>}
        {info && <div style={{ marginTop: 8, color: '#0369a1' }}>{info}</div>}

        <div style={{ marginTop: 12, fontSize: 13, color: '#6b7280' }}>
          Если вы не получили код, попробуйте повторно отправить через несколько секунд.
        </div>
      </div>
    </div>
  );
}