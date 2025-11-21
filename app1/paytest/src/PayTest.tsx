// src/PayTest.tsx
import React, { useEffect, useRef, useState } from "react";
import { createPayment, getStatusByOrderId, markPaid } from "./alfaPay";
import QRCode from "qrcode";

type AlfaStatus = {
  ok?: boolean;
  errorCode?: string | number;
  errorMessage?: string;
  orderId?: string;
  orderNumber?: string | number;
  orderStatus?: number | string;
  paymentState?: string;
  raw?: any;
};

function statusLabel(data?: AlfaStatus) {
  if (!data) return { text: "—", color: "gray" };
  const s =
    (data.paymentState as string) ||
    (data.orderStatus !== undefined ? String(data.orderStatus) : null);

  if (s === null) return { text: "Unknown", color: "gray" };
  if (s === "CREATED" || s === "0" || s === "-100")
    return { text: "Created", color: "orange" };
  if (s === "5" || s === "PREAUTH")
    return { text: "3DS/Redirect", color: "orange" };
  if (s === "DEPOSITED" || s === "2") return { text: "Paid", color: "green" };
  if (s === "6" || s === "DECLINED")
    return { text: "Declined", color: "red" };

  return { text: String(s), color: "blue" };
}

export default function PayTest(): JSX.Element {
  const [serviceId, setServiceId] = useState("test-service-1");
  const [serviceName, setServiceName] = useState("Тестовая услуга");
  const [price, setPrice] = useState<number>(800);
  const [phone, setPhone] = useState("70000000000");
  const [email, setEmail] = useState("test@example.com");

  const [loading, setLoading] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);

  const [formUrl, setFormUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<AlfaStatus | null>(null);
  const pollRef = useRef<number | null>(null);

  const [logs, setLogs] = useState<string[]>([]);
  function pushLog(msg: string) {
    setLogs((s) => [...s, `${new Date().toISOString()} — ${msg}`].slice(-300));
    console.log(msg);
  }

  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

  async function generateQrFromUrl(url: string) {
    try {
      const dataUrl = await QRCode.toDataURL(url);
      setQrDataUrl(dataUrl);
    } catch (err) {
      pushLog("QR generation failed: " + String(err));
      setQrDataUrl(null);
    }
  }

  function startPolling(orderId: string) {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    const doCheck = async () => {
      try {
        const s = await getStatusByOrderId(orderId);
        pushLog("poll status: " + JSON.stringify(s));
        setStatus(s);

        if (
          s &&
          (s.orderStatus === 2 ||
            s.paymentState === "DEPOSITED" ||
            String(s.orderStatus) === "2")
        ) {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          pushLog("Detected PAID — polling stopped");
          setQrDataUrl(null);
        }
      } catch (err) {
        pushLog("poll error: " + String(err));
      }
    };

    doCheck();
    pollRef.current = window.setInterval(doCheck, 3500);
  }

  async function handleCreate(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    pushLog("→ createPayment()");
    setOrderId(null);
    setOrderNumber(null);
    setFormUrl(null);
    setQrDataUrl(null);
    setStatus(null);

    try {
      const payload = {
        service_id: serviceId,
        service_name: serviceName,
        price,
        phone,
        email,
        back_url: window.location.href,
      };

      const resp: any = await createPayment(payload);
      pushLog("createPayment response: " + JSON.stringify(resp));

      const newOrderId = resp.orderId || resp.order_id || null;
      const newOrderNumber = resp.orderNumber || null;
      const fUrl = resp.formUrl || resp.paymentLink || null;

      setOrderId(newOrderId);
      setOrderNumber(newOrderNumber);
      setFormUrl(fUrl);

      if (fUrl) generateQrFromUrl(fUrl);

      if (newOrderId) startPolling(newOrderId);
      else pushLog("NO orderId received — cannot poll!");

    } catch (err: any) {
      pushLog("createPayment exception: " + err);
      alert("Ошибка: " + err);
    } finally {
      setLoading(false);
    }
  }

  async function checkNow() {
    if (!orderId) {
      pushLog("checkNow: no orderId");
      return;
    }
    pushLog("→ manual check");
    const s = await getStatusByOrderId(orderId);
    setStatus(s);
    pushLog("manual status: " + JSON.stringify(s));

    if (
      s.orderStatus === 2 ||
      s.paymentState === "DEPOSITED" ||
      String(s.orderStatus) === "2"
    ) {
      setQrDataUrl(null);
    }
  }

  async function handleMarkPaid() {
    if (!orderId) return pushLog("markPaid: no orderId");

    const r = await markPaid(orderId);
    pushLog("markPaid: " + JSON.stringify(r));

    setStatus({ orderStatus: 2 } as AlfaStatus);
    if (pollRef.current) clearInterval(pollRef.current);
    setQrDataUrl(null);
  }

  const st = statusLabel(status || undefined);

  return (
    <div style={{ maxWidth: 880, margin: "18px auto", fontFamily: "Arial" }}>
      <h1>PayTest — QR</h1>

      <form onSubmit={handleCreate}>
        <div style={{ display: "flex", gap: 12 }}>
          <div>
            <label>Service ID</label>
            <br />
            <input
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
            />
          </div>

          <div style={{ flex: 2 }}>
            <label>Service name</label>
            <br />
            <input
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              style={{ width: "100%" }}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
          <div>
            <label>Price</label>
            <br />
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
            />
          </div>

          <div>
            <label>Phone</label>
            <br />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          <div>
            <label>Email</label>
            <br />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <button disabled={loading} type="submit">
            {loading ? "Создаём…" : "Оплатить (QR)"}
          </button>

          <button type="button" onClick={checkNow} style={{ marginLeft: 8 }}>
            Проверить
          </button>

          <button type="button" onClick={handleMarkPaid} style={{ marginLeft: 8 }}>
            Пометить как оплачено (тест)
          </button>
        </div>
      </form>

      <div style={{ marginTop: 14 }}>
        <strong>orderId:</strong> {orderId || "—"}
        <br />
        <strong>orderNumber:</strong> {orderNumber || "—"}
        <br />
        <strong>formUrl:</strong>{" "}
        {formUrl ? (
          <a href={formUrl} target="_blank">
            Open
          </a>
        ) : (
          "—"
        )}
        <br />

        <div style={{ marginTop: 8 }}>
          <strong>Статус:</strong>
          <span
            style={{
              marginLeft: 8,
              padding: "4px 8px",
              borderRadius: 6,
              background:
                st.color === "green"
                  ? "#D1FAE5"
                  : st.color === "red"
                  ? "#FFE4E6"
                  : st.color === "orange"
                  ? "#FFF7ED"
                  : "#E6F0FF",
              color:
                st.color === "green"
                  ? "#065F46"
                  : st.color === "red"
                  ? "#991B1B"
                  : st.color === "orange"
                  ? "#92400E"
                  : "#0B5CFF",
              fontWeight: 700,
            }}
          >
            {st.text}
          </span>
        </div>
      </div>

      {qrDataUrl && (
        <div
          style={{
            marginTop: 16,
            display: "flex",
            gap: 18,
            alignItems: "center",
          }}
        >
          <img src={qrDataUrl} width={260} height={260} />

          <div>
            <b>Инструкция</b>
            <ul>
              <li>Сканируйте QR</li>
              <li>Оплатите</li>
              <li>Статус обновится автоматически</li>
            </ul>
          </div>
        </div>
      )}

      <hr style={{ margin: "12px 0" }} />

      <h4>Logs</h4>
      <div
        style={{
          maxHeight: 300,
          overflow: "auto",
          background: "#fff",
          padding: 8,
          borderRadius: 8,
        }}
      >
        {logs.map((l, i) => (
          <div
            key={i}
            style={{ fontSize: 12, marginBottom: 4, whiteSpace: "pre-wrap" }}
          >
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}
