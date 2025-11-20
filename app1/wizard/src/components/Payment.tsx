import React, { useEffect, useState } from "react";

/**
 * Payment UI (uses static qrcode.svg by default)
 * - On mount: POST /catalog/api-backend/api/pay/create { bookingId, amount }
 *   -> backend returns { ok, paymentId, orderNumber, paymentLink }
 * - Show qrcode.svg (you already placed it in src/components/qrcode.svg)
 * - Button "Оплатить" opens paymentLink (we append orderNumber if backend returned it)
 * - Poll /catalog/api-backend/api/pay/status?orderNumber=... to learn when paid
 *
 * Usage: <Payment bookingId={bookingId} amount={amount} onPaid={(res)=>{...}} />
 */
type Props = { bookingId: string; amount: number; onPaid?: (res:any)=>void; qrPath?: string };
export default function Payment({ bookingId, amount, onPaid, qrPath = "/src/components/qrcode.svg" }: Props) {
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [paymentLink, setPaymentLink] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("created");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resp = await fetch(`/catalog/api-backend/api/pay/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId, amount }),
        });
        const j = await resp.json();
        if (!resp.ok) {
          setError(j?.error || JSON.stringify(j));
          return;
        }
        if (!mounted) return;
        setPaymentId(j.paymentId || null);
        setOrderNumber(j.orderNumber || null);
        // backend should return a payment link (bank link) — if not, we will use env ALFA link
        setPaymentLink(j.paymentLink || j.qr || (j.raw && j.raw.payment_url) || null);
      } catch (e:any) {
        setError(String(e?.message || e));
      }
    })();
    return () => { mounted = false; };
  }, [bookingId, amount]);

  // Poll backend for status by orderNumber (preferred) or paymentId
  useEffect(() => {
    const key = orderNumber || paymentId;
    if (!key) return;
    let stopped = false;
    const tick = async () => {
      try {
        const url = orderNumber
          ? `/catalog/api-backend/api/pay/status?orderNumber=${encodeURIComponent(orderNumber)}`
          : `/catalog/api-backend/api/pay/status?paymentId=${encodeURIComponent(paymentId || "")}`;
        const r = await fetch(url);
        const j = await r.json();
        const s = j?.status || j?.data?.status || j?.payment?.status || "unknown";
        if (!stopped) setStatus(s);
        if ((s === "paid" || s === "success" || s === "payment_deposited") && !stopped) {
          if (onPaid) onPaid(j);
        }
      } catch (err) {
        // ignore transient
      }
    };
    const t = setInterval(tick, 3000);
    // first immediate poll
    tick();
    return () => { stopped = true; clearInterval(t); };
  }, [orderNumber, paymentId, onPaid]);

  // Default alfa link if backend did not return custom paymentLink
  const defaultAlfaLink = "https://payment.alfabank.ru/sc/YtqrJuXMxIjZREIz";
  // When opening bank link we append orderNumber as query param so the bank will return it back in callback.
  const getAlfaLinkForOpen = () => {
    const base = paymentLink || defaultAlfaLink;
    if (!orderNumber) return base;
    // append orderNumber in querystring — name `orderNumber` used in your callback example
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}orderNumber=${encodeURIComponent(orderNumber)}`;
  };

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: 12, textAlign: "center" }}>
      <h3 style={{ marginBottom: 12 }}>Оплата</h3>

      <div style={{ marginBottom: 12 }}>
        {/* Show static QR you already placed in repo */}
        <img src={qrPath} alt="QR" style={{ width: 260, height: 260, borderRadius: 6 }} />
      </div>

      <div>
        <a href={getAlfaLinkForOpen()} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
          <button style={{ padding: "10px 18px", background: "#0b5cff", color: "#fff", border: 0, borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>
            Оплатить (перейти в Альфа)
          </button>
        </a>
      </div>

      <div style={{ marginTop: 12, color: "#374151" }}>
        <div>Статус: <b>{status}</b></div>
        {orderNumber && <div>orderNumber: <code>{orderNumber}</code></div>}
        {paymentId && <div>paymentId: <code>{paymentId}</code></div>}
        {error && <div style={{ color: "crimson", marginTop: 8 }}>{error}</div>}
      </div>
    </div>
  );
}