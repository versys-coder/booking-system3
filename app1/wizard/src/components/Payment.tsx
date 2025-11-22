// wizard/components/Payment.tsx
import React, { useEffect, useState } from "react";

type Props = {
  bookingId: string;
  amount: number;
  phone?: string;
  onPaid?: (res: any) => void;
  qrPath?: string; // путь до qrcode.svg; wizard/paytest передают импортом
};

const DEFAULT_QR_LOCAL = "qrcode.svg";

/**
 * Payment UI
 *
 * - POST /catalog/api-backend/api/pay/create { bookingId, amount, phone? }
 * - GET  /catalog/api-backend/api/pay/status?orderNumber=... или ?paymentId=...
 *
 * Используется:
 *   - в Wizard как шаг "Оплата";
 *   - отдельно в /paytest/ для отладки.
 */
const Payment: React.FC<Props> = ({ bookingId, amount, phone, onPaid, qrPath }) => {
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [paymentLink, setPaymentLink] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("created");
  const [error, setError] = useState<string | null>(null);

  const qrSrc = qrPath || DEFAULT_QR_LOCAL;

  // Создание платежа
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const resp = await fetch(`/catalog/api-backend/api/pay/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId, amount, phone }),
        });

        const j = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          setError(j?.error || JSON.stringify(j));
          return;
        }
        if (!mounted) return;

        setPaymentId(j.paymentId || null);
        setOrderNumber(j.orderNumber || null);
        // Backend может возвращать ссылку прямо, либо внутри raw
        setPaymentLink(j.paymentLink || j.qr || (j.raw && j.raw.payment_url) || null);
      } catch (e: any) {
        setError(String(e?.message || e));
      }
    })();

    return () => {
      mounted = false;
    };
  }, [bookingId, amount, phone]);

  // Пулинг статуса
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
        const j = await r.json().catch(() => ({}));
        const s = j?.status || j?.data?.status || j?.payment?.status || "unknown";

        if (!stopped) {
          setStatus(s);
        }
        if ((s === "paid" || s === "success" || s === "payment_deposited") && !stopped) {
          if (onPaid) onPaid(j);
        }
      } catch {
        // временные ошибки игнорируем
      }
    };

    const t = window.setInterval(tick, 3000);
    tick(); // первый запрос сразу

    return () => {
      stopped = true;
      window.clearInterval(t);
    };
  }, [orderNumber, paymentId, onPaid]);

  const defaultAlfaLink = "https://payment.alfabank.ru/sc/YtqrJuXMxIjZREIz";

  const getAlfaLinkForOpen = () => {
    const base = paymentLink || defaultAlfaLink;
    if (!orderNumber) return base;
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}orderNumber=${encodeURIComponent(orderNumber)}`;
  };

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: 12, textAlign: "center" }}>
      <h3 style={{ marginBottom: 8 }}>Оплата онлайн</h3>
      <div style={{ marginBottom: 6, fontSize: 14 }}>
        <div>Номер брони: <b>{bookingId}</b></div>
        <div>Сумма к оплате: <b>{amount} руб</b></div>
      </div>

      <div style={{ margin: "16px 0" }}>
        <img
          src={qrSrc}
          alt="QR"
          style={{ width: 260, height: 260, borderRadius: 6 }}
          onError={(e) => {
            console.error("QR load error", e);
          }}
        />
      </div>

      <div>
        <a href={getAlfaLinkForOpen()} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
          <button
            style={{
              padding: "10px 18px",
              background: "#0b5cff",
              color: "#fff",
              border: 0,
              borderRadius: 8,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Оплатить (перейти в Альфа)
          </button>
        </a>
      </div>

      <div style={{ marginTop: 12, color: "#4b5563", fontSize: 13 }}>
        <div>Статус: <b>{status}</b></div>
        {orderNumber && (
          <div>
            orderNumber: <code>{orderNumber}</code>
          </div>
        )}
        {paymentId && (
          <div>
            paymentId: <code>{paymentId}</code>
          </div>
        )}
        {error && (
          <div style={{ color: "crimson", marginTop: 8 }}>
            Ошибка: {error}
          </div>
        )}
        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
          Оплата не обязательна и не влияет на сам факт бронирования.
        </div>
      </div>
    </div>
  );
};

export default Payment;
