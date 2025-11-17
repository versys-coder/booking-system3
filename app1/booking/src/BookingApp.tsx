import React, { useEffect, useState } from "react";
import SmsCodeInput from "./SmsCodeInput";
import { confirmPhone, setPassword, bookSlot } from "@app1/api-client/bookingApi";

/**
 * BookingApp: reads ?start=... (ISO) and/or listens to postMessage { type: 'dvvs:openBooking', payload: { start, pool } }
 * Renders selected time above phone form and handles SMS flow (uses api-client booking functions).
 */

function normalizePhone(inp: string) {
  const digits = String(inp || "").replace(/\D/g, "");
  if (digits.startsWith("8")) return "7" + digits.slice(1);
  if (digits.length === 10 && digits[0] === "9") return "7" + digits;
  return digits;
}

export default function BookingApp(): JSX.Element {
  const [start, setStart] = useState<string | null>(null);
  const [pool, setPool] = useState<string | null>(null);

  const [phone, setPhone] = useState<string>("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string>("");
  const [smsRequested, setSmsRequested] = useState(false);

  const [smsCode, setSmsCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [bookingResult, setBookingResult] = useState<any | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(()=>{
    const qs = new URLSearchParams(window.location.search);
    const s = qs.get("start");
    const p = qs.get("pool");
    if (s) setStart(s);
    if (p) setPool(p);

    function onMsg(e: MessageEvent){
      if (!e.data || typeof e.data !== "object") return;
      if (e.data.type === "dvvs:openBooking" && e.data.payload) {
        if (e.data.payload.start) setStart(e.data.payload.start);
        if (e.data.payload.pool) setPool(e.data.payload.pool);
      }
    }
    window.addEventListener("message", onMsg);
    return ()=> window.removeEventListener("message", onMsg);
  }, []);

  async function handleSendSms(){
    setApiError(null);
    const norm = normalizePhone(phone);
    if (!/^7\d{10}$/.test(norm)) { setPhoneError("Неверный формат телефона"); return; }
    setPhoneError(null);
    try {
      setLoading(true);
      const res = await confirmPhone(norm); // adapt to API shape
      const rid = res?.request_id || res?.requestId || res?.request || "";
      setRequestId(String(rid || ""));
      setSmsRequested(true);
    } catch (e:any) {
      setApiError("Ошибка отправки SMS: " + (e?.message || "Unknown"));
    } finally { setLoading(false); }
  }

  async function handleConfirm(code: string){
    setApiError(null);
    setLoading(true);
    try {
      const norm = normalizePhone(phone);
      await setPassword(norm, code, requestId);
      // Call booking API: adapt to your backend
      const res = await bookSlot({ start, phone: norm });
      setBookingResult(res);
    } catch (e:any) {
      setApiError("Ошибка подтверждения/бронирования: " + (e?.message || "Unknown"));
    } finally { setLoading(false); }
  }

  return (
    <div style={{ padding:20, maxWidth:720, margin:"0 auto", textAlign:"center" }}>
      <h2 style={{ marginBottom:12 }}>{ start ? `Вы выбрали: ${new Date(start).toLocaleString("ru-RU", { day:"2-digit", month:"long", hour:"2-digit", minute:"2-digit" })}` : "Время не выбрано" }</h2>

      {!start && <div>Откройте страницу с параметром ?start=YYYY-MM-DDTHH:MM:SS или отправьте postMessage из виджета.</div>}

      {start && !smsRequested && !bookingResult && (
        <>
          <div style={{ marginTop:12 }}>
            <input value={phone} onChange={(e)=>setPhone(e.target.value)} placeholder="+7 (___) ___-__-__" style={{ padding:10, fontSize:18, width:280, textAlign:"center", borderRadius:8 }} />
            {phoneError && <div style={{ color:"red" }}>{phoneError}</div>}
          </div>
          <div style={{ marginTop:12 }}>
            <button onClick={handleSendSms} disabled={loading} style={{ padding:"10px 20px", borderRadius:16 }}>Отправить SMS</button>
          </div>
          {apiError && <div style={{ color:"red", marginTop:8 }}>{apiError}</div>}
        </>
      )}

      {smsRequested && !bookingResult && (
        <div style={{ marginTop:16 }}>
          <SmsCodeInput phone={phone} smsCode={smsCode} setSmsCode={setSmsCode} onComplete={handleConfirm} onSend={handleSendSms} loading={loading} helper={apiError ?? undefined} />
        </div>
      )}

      {bookingResult && <div style={{ marginTop:16 }}>Бронирование успешно: <pre style={{ textAlign:"left" }}>{JSON.stringify(bookingResult, null, 2)}</pre></div>}
    </div>
  );
}