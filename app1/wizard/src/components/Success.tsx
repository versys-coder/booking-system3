import React, { useEffect, useMemo, useState } from "react";

/**
 * Success
 *
 * This variant is more defensive about the shape of the booking response.
 * It understands shapes like:
 *  - { bookingResult: { data: { appointment: {...}, customer: {...} } } }
 *  - { data: { data: { appointment: {...}, customer: {...} } }, status: 200, raw: "..." }
 *  - { data: { appointment: {...}, client: {...} } }
 *  - { appointment: {...}, customer: {...} }
 *
 * It will:
 *  - Extract appointment and customer (in multiple possible locations)
 *  - Use usertoken/passToken from booking or localStorage to call /client if necessary
 *  - Show booking time, appointment id, client name and phone
 *  - Always show raw booking response for debugging
 */

function shortDateDisplay(raw?: string) {
  if (!raw) return "—";
  try {
    let s = String(raw);
    // normalize "YYYY-MM-DD HH:mm:ss" -> "YYYY-MM-DDTHH:mm:ss" for Date parsing
    if (s.indexOf(" ") !== -1 && s.indexOf("T") === -1) s = s.replace(" ", "T");
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toLocaleString("ru-RU", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" });
    return raw;
  } catch {
    return String(raw);
  }
}

function pickClientFromBooking(payload: any) {
  if (!payload) return null;
  // common places for client/customer
  const candidates = [
    payload?.customer,
    payload?.client,
    payload?.client_data,
    payload?.customer_data,
    payload?.client_info,
    payload?.client || payload?.client_info || payload?.customer,
  ];
  for (const c of candidates) {
    if (c && typeof c === "object") return c;
  }

  // some responses put client inside data.client or data.customer
  if (payload?.data && typeof payload.data === "object") {
    const nested = payload.data;
    if (nested?.client) return nested.client;
    if (nested?.customer) return nested.customer;
  }

  // fallback: search any object value that looks like client
  if (typeof payload === "object") {
    for (const k of Object.keys(payload)) {
      const v = payload[k];
      if (v && typeof v === "object" && (v.client_name || v.name || v.phone || v.email)) return v;
    }
  }

  return null;
}

function extractAppointmentFromBooking(payload: any) {
  if (!payload) return null;
  // try common locations
  if (payload?.appointment) return payload.appointment;
  if (payload?.data?.appointment) return payload.data.appointment;
  if (payload?.data?.data?.appointment) return payload.data.data.appointment;
  if (payload?.booking && payload.booking.appointment) return payload.booking.appointment;
  if (payload?.bookingResult && payload.bookingResult.data && payload.bookingResult.data.appointment) return payload.bookingResult.data.appointment;
  // search inside data
  if (payload?.data && typeof payload.data === "object") {
    const keys = Object.keys(payload.data);
    for (const k of keys) {
      const v = payload.data[k];
      if (v && typeof v === "object" && (v.id && (v.date_time || v.start_date))) return v;
    }
  }
  return null;
}

export default function Success({ client, onNewBooking }: { client?: any; onNewBooking?: () => void }) {
  const [remoteClient, setRemoteClient] = useState<any | null>(null);
  const [loadingClient, setLoadingClient] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  // Normalize incoming booking wrapper to the most useful payload object
  const bookingWrapper = useMemo(() => {
    if (!client) return null;
    // If component received { bookingResult: ... } unwrap it
    if (client.bookingResult) return client.bookingResult;
    // If component received wrapper with status and data.data
    if (client.data && client.data.data) return client.data;
    // Already likely in shape { data: { appointment... } } or { appointment... }
    return client;
  }, [client]);

  // Extract appointment and client payload
  const appointment = useMemo(() => {
    // bookingWrapper may have structure { data: { data: {...} } } => extract deepest
    if (!bookingWrapper) return null;
    // Try the deepest convenience helper
    const candidates = [
      bookingWrapper,
      bookingWrapper.data,
      bookingWrapper.data?.data,
      bookingWrapper.bookingResult,
      bookingWrapper.bookingResult?.data,
    ];
    for (const cand of candidates) {
      const ap = extractAppointmentFromBooking(cand);
      if (ap) return ap;
    }
    return null;
  }, [bookingWrapper]);

  const embeddedClient = useMemo(() => {
    // try to find client/customer object inside bookingWrapper (consider nested data.data)
    if (!bookingWrapper) return null;
    const candidates = [
      bookingWrapper,
      bookingWrapper.data,
      bookingWrapper.data?.data,
      bookingWrapper.bookingResult,
      bookingWrapper.bookingResult?.data,
    ];
    for (const cand of candidates) {
      const c = pickClientFromBooking(cand);
      if (c) return c;
    }
    return null;
  }, [bookingWrapper]);

  // bookingTime from appointment
  const bookingTime = useMemo(() => {
    if (!appointment) return null;
    return appointment?.date_time || appointment?.start_date || appointment?.start || appointment?.date || null;
  }, [appointment]);

  // try to get pass token / usertoken from booking or localStorage
  const guessToken = useMemo(() => {
    // booking may include pass token in multiple places
    const fromBooking =
      bookingWrapper?.data?.pass_token ||
      bookingWrapper?.data?.passToken ||
      bookingWrapper?.pass_token ||
      bookingWrapper?.passToken ||
      bookingWrapper?.token ||
      bookingWrapper?.data?.token;
    return fromBooking || localStorage.getItem('pw:passToken') || localStorage.getItem('pw:pass_token') || null;
  }, [bookingWrapper]);

  useEffect(() => {
    // If embedded client exists — nothing to do
    if (embeddedClient) {
      setRemoteClient(embeddedClient);
      setClientError(null);
      return;
    }

    const token = guessToken;
    if (!token) return;

    let mounted = true;
    setLoadingClient(true);
    setClientError(null);

    (async () => {
      try {
        const base = (window as any).__PW_API_BASE__ || "/catalog/api-backend/api";
        const resp = await fetch(`${base}/client`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ usertoken: token }),
        });
        const text = await resp.text();
        let data: any = null;
        try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
        if (!mounted) return;
        if (!resp.ok) {
          setClientError(`Client API error ${resp.status}: ${JSON.stringify(data).slice(0,600)}`);
          return;
        }
        // backend returns { result: true, data: { ... } } or raw client object
        const resolved = data?.data?.client || data?.client || data?.data || data;
        setRemoteClient(resolved);
      } catch (e: any) {
        if (!mounted) return;
        setClientError(String(e?.message || e));
      } finally {
        if (mounted) setLoadingClient(false);
      }
    })();

    return () => { mounted = false; };
  }, [embeddedClient, guessToken]);

  // helper to format client name
  function formatClientName(c: any) {
    if (!c) return null;
    const maybe =
      c.client_name ||
      c.clientName ||
      c.name ||
      (c.first_name && c.last_name && `${c.first_name} ${c.last_name}`) ||
      c.full_name ||
      c.fio ||
      c.clientName;
    return maybe || null;
  }

  const clientName = formatClientName(remoteClient || embeddedClient);

  // appointment id helper
  const appointmentId = appointment?.id || appointment?.appointment_id || bookingWrapper?.appointment_id || bookingWrapper?.data?.appointment_id || null;

  // raw booking for debug: prefer provided client param raw, else bookingWrapper.raw or client.raw
  const rawBooking = useMemo(() => {
    if (!client) return {};
    if (client.raw) return client.raw;
    if (client.responseText) return client.responseText;
    // try stringify full object
    try { return JSON.stringify(client, null, 2); } catch { return client; }
  }, [client]);

  return (
    <div style={{ maxWidth: 760, margin: "20px auto", textAlign: "center", padding: 12 }}>
      <h2 style={{ marginTop: 4, marginBottom: 12 }}>Бронирование успешно</h2>

      <div style={{ margin: '8px 0 18px', padding: 14, borderRadius: 8, background: 'rgba(255,255,255,0.95)', color: '#0b1320' }}>
        <div style={{ fontSize: 14, opacity: 0.9 }}>Время брони:</div>
        <div style={{ fontSize: 20, fontWeight: 700, marginTop: 8 }}>{bookingTime ? shortDateDisplay(bookingTime) : "—"}</div>
        {appointmentId && <div style={{ marginTop: 6, fontSize: 14 }}>ID занятия: <b>{appointmentId}</b></div>}
        {appointment?.title && <div style={{ marginTop: 6, fontSize: 14 }}>{appointment.title}</div>}
      </div>

      <div style={{ marginTop: 8, marginBottom: 18 }}>
        {loadingClient && <div style={{ marginBottom: 8 }}>Загрузка данных клиента…</div>}
        {clientError && <div style={{ marginBottom: 8, color: "#b91c1c" }}>Не удалось получить данные клиента: {clientError}</div>}
        {clientName ? (
          <div style={{ marginBottom: 8 }}>Имя клиента: <b>{clientName}</b></div>
        ) : (
          <div style={{ marginBottom: 8 }}>Имя клиента: <i>не определено</i></div>
        )}
        {(remoteClient?.phone || embeddedClient?.phone || bookingWrapper?.phone) && (
          <div style={{ marginBottom: 8 }}>Телефон: <b>{(remoteClient?.phone && (Array.isArray(remoteClient.phone) ? remoteClient.phone[0] : remoteClient.phone)) || (embeddedClient?.phone && (Array.isArray(embeddedClient.phone) ? embeddedClient.phone[0] : embeddedClient.phone)) || bookingWrapper?.phone}</b></div>
        )}
        <div style={{ fontSize: 13, color: "#444", marginTop: 6 }}>Пожалуйста, проверьте SMS/почту для подтверждения.</div>
      </div>

      <div style={{ textAlign: "left", marginTop: 6 }}>
        <div style={{ fontSize: 13, marginBottom: 6, color: "#666" }}>Raw booking response (для отладки):</div>
        <pre style={{ whiteSpace: "pre-wrap", maxHeight: 360, overflow: "auto", background: "#f7f7f7", padding: 12, borderRadius: 8 }}>
          {typeof rawBooking === "string" ? rawBooking : JSON.stringify(rawBooking, null, 2)}
        </pre>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12 }}>
        <button onClick={() => { try { onNewBooking && onNewBooking(); } catch(e){ } }} style={{ padding: '10px 18px', borderRadius: 12, minWidth: 140, fontWeight: 700, cursor: 'pointer', background: '#111827', color: '#fff', border: 'none' }}>
          Закрыть
        </button>
      </div>
    </div>
  );
}