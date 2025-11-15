import React, { useState, useRef, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { Alert, CircularProgress, Paper, Typography, Box, Container } from "@mui/material";
import SmsCodeInput from "../SmsCodeInput";

const BASE_API_URL = process.env.REACT_APP_BASE_API_URL || "";
const CONFIRM_PHONE_PROXY_URL = `${BASE_API_URL}/api/confirm_phone`;
const CLIENT_PROXY_URL = `${BASE_API_URL}/api/client`;
const BOOK_PROXY_URL = `${BASE_API_URL}/api/book`;
const ARAMBA_SMS_API_URL = `${BASE_API_URL}/api/sms`;

export interface VirtualSlot {
  appointment_id: string;
  start_date: string;
  date: string;
  hour: number;
}

interface BookingApiData {
  data?: {
    data?: {
      appointment?: any;
      customer?: any;
    };
  };
}

interface QuickBookingFlowProps {
  virtualSlot: VirtualSlot | null;
  onReset: () => void;
  hintWhenNoSlot?: string;
  embedded?: boolean;
}

function normalizePhone(p: string) {
  const digits = p.replace(/\D/g, "");
  if (digits.startsWith("8")) return "7" + digits.slice(1);
  if (digits.startsWith("7")) return digits;
  return "7" + digits;
}

function validatePhone(p: string) {
  const norm = normalizePhone(p);
  return /^7\d{10}$/.test(norm);
}

function formatPhoneInput(raw: string) {
  const d = raw.replace(/\D/g, "").replace(/^8/, "7").slice(0, 11);
  if (!d) return "+7 (";
  const p = ["+7 ("];
  if (d.length > 1) p.push(d.slice(1, 4));
  if (d.length >= 4) p.push(") ");
  if (d.length >= 4) p.push(d.slice(4, 7));
  if (d.length >= 7) p.push("-");
  if (d.length >= 7) p.push(d.slice(7, 9));
  if (d.length >= 9) p.push("-");
  if (d.length >= 9) p.push(d.slice(9, 11));
  return p.join("");
}

const weekdayNames = [
  "Воскресенье",
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
];

const QuickBookingFlow: React.FC<QuickBookingFlowProps> = ({
  virtualSlot,
  onReset,
  hintWhenNoSlot,
  embedded = false,
}) => {
  const [phone, setPhone] = useState("+7 (");
  const [phoneError, setPhoneError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [smsRequested, setSmsRequested] = useState(false);

  const [requestId, setRequestId] = useState<string | null>(null);
  const [smsCode, setSmsCode] = useState("");
  const [smsCodeError, setSmsCodeError] = useState(false);
  const [smsCodeHelper, setSmsCodeHelper] = useState("");
  const [smsCodeLoading, setSmsCodeLoading] = useState(false);
  const [smsCodeLocked, setSmsCodeLocked] = useState(false);

  const triedCodesRef = useRef<Set<string>>(new Set());
  const attemptingRef = useRef(false);

  const [bookingResult, setBookingResult] = useState<BookingApiData | null>(null);
  const [smsSent, setSmsSent] = useState<string | null>(null);

  useEffect(() => {
    return () => {};
  }, []);

  useEffect(() => {}, [requestId]);
  useEffect(() => {}, [phone]);

  useEffect(() => {
    if (virtualSlot && bookingResult) {
      resetAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [virtualSlot?.appointment_id]);

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatPhoneInput(e.target.value);
    setPhone(formatted);
    setPhoneError(!validatePhone(formatted));
  }

  async function requestSmsCode() {
    if (!validatePhone(phone)) {
      setPhoneError(true);
      return;
    }
    if (!virtualSlot) {
      setApiError("Слот не выбран");
      return;
    }
    if (virtualSlot.appointment_id.startsWith("virtual-")) {
      setApiError("Нет реального слота для бронирования (ожидается appointment_id)");
      return;
    }
    setLoading(true);
    setApiError("");
    try {
      const newId = uuidv4();
      setRequestId(newId);
      const normPhone = normalizePhone(phone);

      const res = await fetch(CONFIRM_PHONE_PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normPhone, method: "sms", request_id: newId }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Ошибка отправки телефона: ${txt}`);
      }
      setSmsRequested(true);
      setSmsCode("");
      setSmsCodeError(false);
      setSmsCodeHelper("");
      triedCodesRef.current.clear();
      attemptingRef.current = false;
      setSmsCodeLocked(false);
    } catch (e: any) {
      setApiError(e?.message || "Ошибка отправки телефона");
    } finally {
      setLoading(false);
    }
  }

  async function confirmCodeAndBook(codeArg?: string) {
    const code = codeArg ?? smsCode;
    if (code.length !== 4) {
      setSmsCodeError(true);
      setSmsCodeHelper("Введите 4 цифры");
      return;
    }
    if (!virtualSlot) {
      setApiError("Слот не выбран");
      return;
    }
    if (virtualSlot.appointment_id.startsWith("virtual-")) {
      setApiError("Слот ещё не сопоставлен реальному timeslot (нет appointment_id).");
      return;
    }
    if (attemptingRef.current || smsCodeLocked || triedCodesRef.current.has(code)) return;

    attemptingRef.current = true;
    setSmsCodeLocked(true);
    setSmsCodeLoading(true);
    setSmsCodeError(false);
    setSmsCodeHelper("");
    setApiError("");

    try {
      const normPhone = normalizePhone(phone);

      // 1. Подтверждение кода
      const res = await fetch(CONFIRM_PHONE_PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: normPhone,
          confirmation_code: code,
          request_id: requestId,
          method: "sms",
        }),
      });
      let data: any = {};
      try { data = await res.json(); } catch {/* ignore */}
      const passToken: string | undefined = data.pass_token || data?.data?.pass_token;
      if (!res.ok || !passToken) {
        triedCodesRef.current.add(code);
        setSmsCodeError(true);
        setSmsCodeHelper("Неверный код");
        setSmsCodeLocked(false);
        return;
      }

      // 2. Проверка клиента
      const clientRes = await fetch(CLIENT_PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usertoken: passToken }),
      });
      if (!clientRes.ok) {
        const txt = await clientRes.text();
        throw new Error(`Ошибка клиента: ${txt}`);
      }
      await clientRes.json();

      // 3. Бронирование
      const bookRes = await fetch(BOOK_PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointment_id: virtualSlot.appointment_id,
          usertoken: passToken,
        }),
      });
      let bookData: any = {};
      const ctype = bookRes.headers.get("content-type") || "";
      if (ctype.includes("application/json")) {
        bookData = await bookRes.json();
      } else {
        bookData.raw = await bookRes.text();
      }
      if (!bookRes.ok) {
        throw new Error(bookData?.error || "Ошибка бронирования");
      }
      setBookingResult(bookData);

      // 4. SMS подтверждение
      try {
        const smsRes = await fetch(ARAMBA_SMS_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: normPhone,
            text: "Вы записаны в бассейн.",
          }),
        });
        if (smsRes.ok) {
          setSmsSent("SMS отправлено успешно");
        } else {
          const t = await smsRes.text();
          setSmsSent("Ошибка отправки SMS: " + t);
        }
      } catch (e: any) {
        setSmsSent("Ошибка отправки SMS: " + (e?.message || "Unknown"));
      }
    } catch (e: any) {
      setApiError("Ошибка при финальном бронировании: " + (e?.message || "Unknown"));
      setSmsCodeError(true);
      setSmsCodeHelper("Ошибка. Попробуйте другой код.");
      setSmsCodeLocked(false);
    } finally {
      setSmsCodeLoading(false);
      attemptingRef.current = false;
    }
  }

  function resetAll() {
    setPhone("+7 (");
    setPhoneError(false);
    setLoading(false);
    setApiError("");
    setSmsRequested(false);
    setSmsCode("");
    setSmsCodeError(false);
    setSmsCodeHelper("");
    setSmsCodeLoading(false);
    setSmsCodeLocked(false);
    setBookingResult(null);
    setSmsSent(null);
    triedCodesRef.current.clear();
    attemptingRef.current = false;
    onReset();
  }

  // Весь JSX выводим так:
  const content = (
    <>
      <Typography className="header-title" variant="h5" align="center">
        Быстрое бронирование
      </Typography>
      {virtualSlot && !bookingResult && (
        <Typography
          align="center"
          style={{
            marginTop: 8,
            fontSize: 18,
            color: "var(--theme-color)",
            letterSpacing: ".02em",
            fontWeight: 700,
          }}
        >
          {(() => {
            const d = new Date(virtualSlot.start_date.replace(" ", "T"));
            return (
              <>
                Дата:{" "}
                <b>
                  {d.toLocaleDateString("ru-RU", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}{" "}
                  ({weekdayNames[d.getDay()]})
                </b>
                <br />
                Время:{" "}
                <b>
                  {d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                </b>
              </>
            );
          })()}
          {virtualSlot.appointment_id.startsWith("virtual-") && (
            <span style={{ display:"block", marginTop:6, fontSize:12, color:"#d22", fontWeight:700 }}>
              Нет реального appointment_id — бронирование недоступно
            </span>
          )}
        </Typography>
      )}

      {!virtualSlot && (
        <Box
          style={{
            marginTop: 24,
            fontSize: 18,
            textAlign: "center",
            fontWeight: 600,
            color: "var(--theme-color)",
          }}
        >
          {hintWhenNoSlot || "Выберите время в виджете слева"}
        </Box>
      )}

      {apiError && (
        <Alert className="alert-error" severity="error" style={{ marginTop: 16 }}>
          {apiError}
        </Alert>
      )}

      {/* Ввод телефона */}
      {virtualSlot && !smsRequested && !bookingResult && (
        <Box
          style={{
            marginTop: 32,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
          }}
        >
          <input
            className="phone-input"
            value={phone}
            onChange={handlePhoneChange}
            placeholder="+7 (999) 999-99-99"
            type="tel"
            disabled={loading}
            style={{ fontSize: 20 }}
          />
          {phoneError && (
            <div style={{ color: "#d32f2f", fontWeight: 700, marginBottom: 8 }}>
              Введите корректный номер
            </div>
          )}
          <button
            className="button-main"
            disabled={
              loading ||
              !validatePhone(phone) ||
              !virtualSlot ||
              virtualSlot.appointment_id.startsWith("virtual-")
            }
            onClick={requestSmsCode}
          >
            Получить SMS-код
          </button>
          <button className="button-secondary" onClick={resetAll} type="button">
            Сбросить
          </button>
        </Box>
      )}

      {/* Ввод кода из SMS */}
      {virtualSlot && smsRequested && !bookingResult && (
        <Box style={{ marginTop: 32 }}>
          <Typography
            align="center"
            style={{
              fontWeight: 700,
              fontSize: 20,
              color: "var(--theme-color)",
              marginBottom: 8,
            }}
          >
            Введите код из SMS
          </Typography>
          <Box
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
            }}
          >
            <SmsCodeInput
              value={smsCode}
              onChange={(val) => {
                setSmsCode(val);
                if (smsCodeError) {
                  setSmsCodeError(false);
                  setSmsCodeHelper("");
                }
                setSmsCodeLocked(false);
              }}
              length={4}
              error={smsCodeError}
              helperText={smsCodeHelper}
              disabled={smsCodeLoading}
              onComplete={confirmCodeAndBook}
            />
            {smsCodeLoading && (
              <Box
                style={{
                  display: "flex",
                  justifyContent: "center",
                  padding: "16px 0",
                  minHeight: 55,
                }}
              >
                <CircularProgress />
              </Box>
            )}
            <button className="button-secondary" onClick={resetAll} type="button">
              Назад
            </button>
            <button
              className="button-main"
              disabled={
                smsCodeLoading ||
                smsCode.length !== 4 ||
                smsCodeLocked ||
                triedCodesRef.current.has(smsCode)
              }
              onClick={() => confirmCodeAndBook()}
              type="button"
            >
              Подтвердить
            </button>
          </Box>
        </Box>
      )}

      {/* Успех */}
      {bookingResult && (
        <Box className="booking-success">
          <Typography
            className="booking-title"
            variant="h4"
            gutterBottom
            style={{ fontSize: 28 }}
          >
            Бронирование
            <br /> выполнено
          </Typography>
          {bookingResult?.data?.data?.appointment &&
            bookingResult?.data?.data?.customer && (
              <Typography className="booking-details" variant="h6">
                {
                  bookingResult.data.data.customer[
                    "client_name"
                  ] as string
                }{" "}
                записан на занятие{" "}
                {bookingResult.data.data.appointment.title}
                <br />
                {bookingResult.data.data.appointment.date_time
                  ? `в ${new Date(
                      bookingResult.data.data.appointment.date_time.replace(" ", "T")
                    ).toLocaleDateString("ru-RU", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })} в ${new Date(
                      bookingResult.data.data.appointment.date_time.replace(" ", "T")
                    ).toLocaleTimeString("ru-RU", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}`
                  : ""}
              </Typography>
            )}
          {smsSent && (
            <Alert
              className="sms-alert"
              severity={smsSent.startsWith("SMS отправлено") ? "success" : "warning"}
            >
              {smsSent}
            </Alert>
          )}
          <button className="new-booking-button" onClick={resetAll} type="button">
            Новое бронирование
          </button>
        </Box>
      )}
    </>
  );

  if (embedded) {
    return (
      <div className="quick-booking-root">
        <Paper className="paper quick-embedded-paper" elevation={10}>
          {content}
        </Paper>
      </div>
    );
  }
  return (
    <Container className="main-container" maxWidth="sm">
      <Paper className="paper" elevation={10}>
        {content}
      </Paper>
    </Container>
  );
};

export default QuickBookingFlow;