import React, { useEffect, useState } from "react";
import { createPayment, getStatusByOrderId } from "../alfaPay";
import { QRCodeSVG } from "qrcode.react";

type PaymentProps = {
  serviceId: string;
  serviceName: string;
  startDateTime: string;
  phone: string;
  // testMode оставлен только ради совместимости, но НЕ используется.
  testMode?: boolean;
  onPaid?: () => void;
};

type StatusResponse = {
  ok: boolean;
  paid?: boolean;
  orderStatus?: number;
  actionCode?: number;
  errorCode?: string;
  errorMessage?: string;
  paymentAmountInfo?: any;
  raw?: any;
};

const PRICE_RUB = 2;

const Payment: React.FC<PaymentProps> = ({
  serviceId,
  serviceName,
  startDateTime,
  phone,
  onPaid
}) => {
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [formUrl, setFormUrl] = useState<string | null>(null);

  const [paid, setPaid] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [lastStatus, setLastStatus] = useState<StatusResponse | null>(null);

  // Создание платежа в Альфе
  useEffect(() => {
    if (!phone || !serviceId || !serviceName) return;

    let cancelled = false;

    async function run() {
      setCreating(true);
      setCreateError(null);
      setOrderId(null);
      setOrderNumber(null);
      setFormUrl(null);
      setPaid(false);
      setStatusError(null);
      setLastStatus(null);

      try {
        const backUrl =
          typeof window !== "undefined"
            ? window.location.href.split("#")[0]
            : "";

        const resp: any = await createPayment({
          service_id: serviceId,
          service_name: serviceName,
          price: PRICE_RUB, // 2 рубля, боевой режим
          phone,
          back_url: backUrl || undefined
        });

        if (cancelled) return;

        if (!resp || resp.ok === false) {
          const msg =
            resp?.message ||
            resp?.error ||
            "Не удалось создать платёж в Альфа-банке";
          setCreateError(msg);
          return;
        }

        setOrderId(resp.orderId || null);
        setOrderNumber(resp.orderNumber || null);
        setFormUrl(resp.formUrl || null);
      } catch (e: any) {
        if (cancelled) return;
        setCreateError(String(e?.message || e));
      } finally {
        if (!cancelled) setCreating(false);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [serviceId, serviceName, startDateTime, phone]);

  // Пулинг статуса оплаты
  useEffect(() => {
    if (!orderId || paid) return;

    let stopped = false;
    let timer: any;

    const poll = async () => {
      if (stopped) return;
      try {
        const resp: any = await getStatusByOrderId(orderId);
        if (stopped) return;

        setLastStatus(resp);
        setStatusError(null);

        if (resp && resp.ok && resp.paid) {
          setPaid(true);
          try {
            onPaid && onPaid();
          } catch {}
          return;
        }
      } catch (e: any) {
        if (stopped) return;
        setStatusError(String(e?.message || e));
      } finally {
        if (!stopped && !paid) {
          timer = setTimeout(poll, 3000);
        }
      }
    };

    poll();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [orderId, paid, onPaid]);

  if (!phone || !serviceId) return null;

  return (
    <div
      style={{
        borderRadius: 12,
        padding: 16,
        background: "#f9fafb",
        border: "1px solid #e5e7eb",
        textAlign: "center"
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: 8 }}>Оплата онлайн</h3>
      <div style={{ fontSize: 14, marginBottom: 8 }}>
        Оплата не обязательна и не влияет на сам факт бронирования.
      </div>
      <div style={{ fontSize: 14, marginBottom: 4 }}>
        Услуга: <b>{serviceName}</b>
      </div>
      <div style={{ fontSize: 14, marginBottom: 4 }}>
        Стоимость: <b>{PRICE_RUB} руб.</b>
      </div>
      <div style={{ fontSize: 14, marginBottom: 12 }}>
        Телефон: <b>{phone}</b>
      </div>

      {creating && (
        <div style={{ fontSize: 14, marginTop: 8 }}>
          Создание счёта в Альфа-банке…
        </div>
      )}

      {createError && (
        <div
          style={{
            marginTop: 8,
            padding: 8,
            borderRadius: 8,
            background: "#fef2f2",
            color: "#b91c1c",
            fontSize: 13
          }}
        >
          Ошибка при создании платежа: {createError}
        </div>
      )}

      {!creating && !createError && !orderId && (
        <div style={{ fontSize: 14, marginTop: 8 }}>
          Не удалось получить идентификатор заказа.
        </div>
      )}

      {/* Не оплачено: QR + кнопка Альфы */}
      {orderId && !paid && (
        <>
          {formUrl ? (
            <div style={{ marginTop: 8, marginBottom: 12 }}>
              <div style={{ fontSize: 14, marginBottom: 8 }}>
                Отсканируйте QR-код для оплаты:
              </div>
              <div
                style={{
                  display: "inline-block",
                  padding: 12,
                  borderRadius: 16,
                  background: "#ffffff",
                  boxShadow: "0 10px 25px rgba(15, 23, 42, 0.08)"
                }}
              >
                <QRCodeSVG
                  value={formUrl}
                  size={180}
                  includeMargin={true}
                />
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "#6b7280",
                  marginTop: 8
                }}
              >
                QR-код ведёт на страницу оплаты Альфа-банка (СБП + карты).
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 14, marginTop: 8 }}>
              Нет ссылки на форму оплаты (formUrl).
            </div>
          )}

          {formUrl && (
            <div style={{ marginTop: 16 }}>
              <a
                href={formUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-block",
                  padding: "10px 18px",
                  borderRadius: 999,
                  background: "#111827",
                  color: "#ffffff",
                  textDecoration: "none",
                  fontWeight: 600,
                  fontSize: 14
                }}
              >
                Оплатить через Альфа-Банк
              </a>
            </div>
          )}

          <div
            style={{
              fontSize: 12,
              color: "#6b7280",
              marginTop: 10
            }}
          >
            После успешной оплаты QR-код исчезнет, и здесь появится
            сообщение об успешной оплате.
          </div>

          {statusError && (
            <div
              style={{
                marginTop: 8,
                padding: 8,
                borderRadius: 8,
                background: "#fffbeb",
                color: "#92400e",
                fontSize: 12
              }}
            >
              Ошибка получения статуса оплаты: {statusError}
            </div>
          )}
        </>
      )}

      {/* Оплата прошла */}
      {paid && (
        <div
          style={{
            marginTop: 8,
            padding: 10,
            borderRadius: 10,
            background: "#ecfdf3",
            color: "#166534",
            fontSize: 14,
            fontWeight: 500
          }}
        >
          Оплата успешно получена. Ждём вас!
        </div>
      )}

      {orderNumber && (
        <div
          style={{
            fontSize: 11,
            color: "#9ca3af",
            marginTop: 8
          }}
        >
          Номер заказа в банке: {orderNumber}
        </div>
      )}

      {lastStatus && !paid && (
        <div
          style={{
            fontSize: 11,
            color: "#9ca3af",
            marginTop: 4
          }}
        >
          Статус заказа: {lastStatus.orderStatus} (code{" "}
          {lastStatus.actionCode}, err {lastStatus.errorCode})
        </div>
      )}
    </div>
  );
};

export default Payment;
