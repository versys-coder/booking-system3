import React, { useState, useEffect, useRef, ChangeEvent } from "react";
import {
  Container,
  Typography,
  Button,
  TextField,
  Box,
  Paper,
  CircularProgress,
  Alert,
} from "@mui/material";
import { v4 as uuidv4 } from "uuid";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { log } from "./logger";
import "./styles.css";

const BASE_API_URL =
  process.env.REACT_APP_BASE_API_URL || "http://10.18.15.85:4000";

const SLOTS_PROXY_URL = `${BASE_API_URL}/api/slots`;
const CONFIRM_PHONE_PROXY_URL = `${BASE_API_URL}/api/confirm_phone`;
const SET_PASSWORD_PROXY_URL = `${BASE_API_URL}/api/set_password`;
const CLIENT_PROXY_URL = `${BASE_API_URL}/api/client`;
const BOOK_PROXY_URL = `${BASE_API_URL}/api/book`;
const ARAMBA_SMS_API_URL = `${BASE_API_URL}/api/sms`;

const TARGET_SERVICE_ID = "9672bb23-7060-11f0-a902-00583f11e32d";

const WEEKDAYS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"] as const;
const MONTHS = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
] as const;

interface Slot {
  appointment_id: string;
  start_date: string;
  service_id: string;
  [key: string]: any;
}
interface SlotsApiResponse {
  slots?: Slot[];
  [key: string]: any;
}
interface BookingApiAppointment {
  date_time?: string;
  title?: string;
  [key: string]: any;
}
interface BookingApiCustomer {
  client_name?: string;
  last_name?: string;
  name?: string;
  second_name?: string;
  phone?: string | string[];
  [key: string]: any;
}
interface BookingApiData {
  data?: {
    appointment?: BookingApiAppointment;
    customer?: BookingApiCustomer;
    [key: string]: any;
  };
  [key: string]: any;
}
interface BookingResult {
  data?: BookingApiData;
  error?: string;
  raw?: string;
  [key: string]: any;
}
interface SendSmsArambaArgs {
  phone: string;
  fio: string;
  date: string;
  time: string;
}

function getUserLocalDate(): Date {
  return new Date();
}
function getUserLocalDateString(): string {
  return getUserLocalDate().toISOString().split("T")[0];
}

async function sendSmsAramba({ phone, fio, date, time }: SendSmsArambaArgs): Promise<any> {
  log("SMS_API sendSmsAramba", { phone, fio, date, time });
  const body = {
    SenderId: "DVVS-EKB",
    UseRecepientTimeZone: "True",
    PhoneNumber: phone,
    Text: `${fio}, вы записаны на свободное плавание ${date} в ${time}.`,
  };
  try {
    const res = await fetch(ARAMBA_SMS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      log("SMS_API ERROR", { status: res.status, text });
      throw new Error(`SMS API: ${res.status} ${text}`);
    }
    const json = await res.json();
    log("SMS_API OK", json);
    return json;
  } catch (e: unknown) {
    log("SMS_API CATCH", e);
    return { error: (e as Error).message };
  }
}

function normalizePhone(phone: string): string {
  let digits = String(phone).replace(/\D/g, "");
  if (digits.startsWith("8")) digits = "7" + digits.slice(1);
  if (digits.startsWith("7") && digits.length === 11) return digits;
  if (digits.length === 10 && digits[0] === "9") return "7" + digits;
  return digits;
}
function formatPhoneInput(input: string): string {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("8")) digits = "7" + digits.slice(1);
  if (!digits.startsWith("7")) digits = "7" + digits;
  digits = digits.substring(0, 11);

  let formatted = "+7 (";
  if (digits.length > 1) formatted += digits.substring(1, 4);
  if (digits.length > 4) formatted += ") " + digits.substring(4, 7);
  if (digits.length > 7) formatted += "-" + digits.substring(7, 9);
  if (digits.length > 9) formatted += "-" + digits.substring(9, 11);
  return formatted;
}
function validatePhone(phone: string): boolean {
  return /^7\d{10}$/.test(normalizePhone(phone));
}

interface SmsCodeInputProps {
  value: string;
  onChange: (val: string) => void;
  length?: number;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
  onComplete?: (val: string) => void;
}
const SmsCodeInput: React.FC<SmsCodeInputProps> = ({
  value,
  onChange,
  length = 4,
  error,
  helperText,
  disabled,
  onComplete,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
  }, [disabled]);

  useEffect(() => {
    if (value.length === length && !disabled && onComplete) {
      onComplete(value);
    }
  }, [value, disabled, length, onComplete]);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    if (disabled) return;
    const val = e.target.value.replace(/\D/g, "").slice(0, length);
    onChange(val);
    log("INPUT change", val);
  }

  function handleNumPadClick(num: number) {
    if (disabled) return;
    if (value.length < length) {
      const nextValue = (value + num).slice(0, length);
      onChange(nextValue);
      log("INPUT numpad +", nextValue);
    }
  }
  function handleNumPadBackspace() {
    if (disabled) return;
    const nextValue = value.slice(0, -1);
    onChange(nextValue);
    log("INPUT backspace", nextValue);
  }

  return (
    <Box style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <input
        ref={inputRef}
        className="sms-input"
        value={value}
        onChange={handleChange}
        maxLength={length}
        style={{ marginBottom: 8 }}
        disabled={disabled}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
      />
      {error && (
        <div style={{ color: "#d32f2f", fontWeight: 700, marginBottom: 8 }}>
          {helperText}
        </div>
      )}
      <Box className="numpad-row">
        {[1, 2, 3].map((n) => (
          <button
            key={n}
            className="numpad-button"
            onClick={() => handleNumPadClick(n)}
            tabIndex={-1}
            disabled={disabled}
            type="button"
          >
            {n}
          </button>
        ))}
      </Box>
      <Box className="numpad-row">
        {[4, 5, 6].map((n) => (
          <button
            key={n}
            className="numpad-button"
            onClick={() => handleNumPadClick(n)}
            tabIndex={-1}
            disabled={disabled}
            type="button"
          >
            {n}
          </button>
        ))}
      </Box>
      <Box className="numpad-row">
        {[7, 8, 9].map((n) => (
          <button
            key={n}
            className="numpad-button"
            onClick={() => handleNumPadClick(n)}
            tabIndex={-1}
            disabled={disabled}
            type="button"
          >
            {n}
          </button>
        ))}
      </Box>
      <Box className="numpad-row">
        <button
          className="numpad-button"
          onClick={handleNumPadBackspace}
          tabIndex={-1}
          disabled={disabled}
          type="button"
        >
          ⌫
        </button>
        <button
          className="numpad-button"
          onClick={() => handleNumPadClick(0)}
          tabIndex={-1}
          disabled={disabled}
          type="button"
        >
          0
        </button>
      </Box>
    </Box>
  );
};

interface SlotPickerProps {
  slotsByDate: Record<string, Slot[]>;
  calendarDates: string[];
  currentDateIdx: number;
  setCurrentDateIdx: React.Dispatch<React.SetStateAction<number>>;
  selectedSlot: Slot | null;
  setSelectedSlot: React.Dispatch<React.SetStateAction<Slot | null>>;
  isLoading: boolean;
}

const SlotPicker: React.FC<SlotPickerProps> = ({
  slotsByDate,
  calendarDates,
  currentDateIdx,
  setCurrentDateIdx,
  selectedSlot,
  setSelectedSlot,
  isLoading,
}) => {
  const ALL_TIMES = [
    "07:00",
    "08:00",
    "09:00",
    "10:00",
    "11:00",
    "12:00",
    "13:00",
    "14:00",
    "15:00",
    "16:00",
    "17:00",
    "18:00",
    "19:00",
    "20:00",
    "21:00",
  ];

  if (isLoading) {
    return (
      <Box style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
        <CircularProgress size={48} />
      </Box>
    );
  }
  if (!calendarDates.length) return null;

  const selectedDate = calendarDates[currentDateIdx];
  const slotList = slotsByDate[selectedDate] || [];
  const isWorkingDay = (() => {
    const d = new Date(selectedDate + "T00:00:00");
    const day = d.getDay();
    return day >= 1 && day <= 5;
  })();
  const nowLocal = getUserLocalDate();
  const nowLocalDateString = getUserLocalDateString();

  function formatDatePretty(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00");
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} (${WEEKDAYS[d.getDay()]})`;
  }

  const slotsByTime: Record<string, Slot> = {};
  slotList.forEach((slot) => {
    const slotTime = new Date(slot.start_date.replace(" ", "T")).toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });
    slotsByTime[slotTime] = slot;
  });

  const InactiveTimeSlot: React.FC<{ time: string }> = ({ time }) => (
    <div className="time-slot">{time}</div>
  );

  return (
    <Box>
      <Box
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
          marginTop: 8,
        }}
      >
        <Button
          style={{ minWidth: 32, borderRadius: 5 }}
          onClick={() => setCurrentDateIdx((i) => Math.max(i - 1, 0))}
          disabled={currentDateIdx === 0}
          color="primary"
        >
          {"<"}
        </Button>
        <Typography
          align="center"
          style={{
            fontWeight: 700,
            fontSize: 26,
            margin: "0 16px",
            color: "#31628c",
            letterSpacing: "0.02em",
          }}
        >
          {formatDatePretty(selectedDate)}
        </Typography>
        <Button
          style={{ minWidth: 32, borderRadius: 5 }}
          onClick={() => setCurrentDateIdx((i) => Math.min(i + 1, calendarDates.length - 1))}
          disabled={currentDateIdx === calendarDates.length - 1}
          color="primary"
        >
          {">"}
        </Button>
      </Box>
      <Box
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 8,
          marginBottom: 16,
        }}
      >
        {ALL_TIMES.map((time) => {
          if (isWorkingDay && time === "12:00") {
            return <InactiveTimeSlot key={time} time={time} />;
          }
          const slot = slotsByTime[time];
          if (slot) {
            const [hour, minute] = time.split(":");
            const slotDate = new Date(`${selectedDate}T${hour}:${minute}:00`);
            if (selectedDate === nowLocalDateString && slotDate < nowLocal) {
              return <InactiveTimeSlot key={time} time={time} />;
            }
            const isSelected = selectedSlot?.appointment_id === slot.appointment_id;
            return (
              <Button
                key={time}
                className={`slot-button${isSelected ? " selected" : ""}`}
                variant={isSelected ? "contained" : "outlined"}
                color={isSelected ? "primary" : "inherit"}
                onClick={() => setSelectedSlot(slot)}
                endIcon={isSelected ? <CheckCircleIcon sx={{ fontSize: 21 }} /> : null}
              >
                {time}
              </Button>
            );
          }
          return <InactiveTimeSlot key={time} time={time} />;
        })}
      </Box>
      {selectedSlot && (
        <Typography
          align="center"
          style={{
            marginTop: 8,
            fontSize: 20,
            color: "#31628c",
            letterSpacing: "0.01em",
            fontWeight: 700,
          }}
        >
          Вы выбрали:{" "}
          <b>
            {new Date(selectedSlot.start_date.replace(" ", "T")).toLocaleTimeString("ru-RU", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </b>
        </Typography>
      )}
    </Box>
  );
};

const App: React.FC = () => {
  const [slotsByDate, setSlotsByDate] = useState<Record<string, Slot[]>>({});
  const [calendarDates, setCalendarDates] = useState<string[]>([]);
  const [currentDateIdx, setCurrentDateIdx] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string>("");

  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [phone, setPhone] = useState<string>("+7 (");
  const [smsRequested, setSmsRequested] = useState<boolean>(false);

  const [smsCode, setSmsCode] = useState<string>("");
  const [smsCodeError, setSmsCodeError] = useState<boolean>(false);
  const [smsCodeHelper, setSmsCodeHelper] = useState<string>("");

  const [requestId, setRequestId] = useState<string>("");
  const [bookingResult, setBookingResult] = useState<BookingResult | null>(null);
  const [smsSent, setSmsSent] = useState<string | null>(null);

  const [smsCodeLoading, setSmsCodeLoading] = useState<boolean>(false);
  const [smsCodeLocked, setSmsCodeLocked] = useState<boolean>(false);

  const [phoneError, setPhoneError] = useState<boolean>(false);

  const attemptingRef = useRef(false);
  const triedCodesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    fetchWeekSlots();
    // eslint-disable-next-line
  }, []);

  async function fetchWeekSlots(): Promise<void> {
    setLoading(true);
    setApiError("");
    try {
      const res = await fetch(SLOTS_PROXY_URL, { method: "GET" });
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const text = await res.text();
        throw new Error(`Сервер вернул не JSON:\n${text.substring(0, 300)}`);
      }
      if (!res.ok) throw new Error("API fetch error: " + res.status);

      const data: SlotsApiResponse = await res.json();
      const filteredSlots: Slot[] = Array.isArray(data.slots)
        ? data.slots.filter((slot) => slot.service_id === TARGET_SERVICE_ID)
        : [];

      const today = getUserLocalDate();
      const todayWeekDay = today.getDay();
      const weekDates: string[] = [];
      for (let i = 0; i <= 6 - todayWeekDay; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        weekDates.push(d.toISOString().split("T")[0]);
      }

      const byDate: Record<string, Slot[]> = {};
      filteredSlots.forEach((slot) => {
        const date = slot.start_date.replace(" ", "T").split("T")[0];
        if (weekDates.includes(date)) {
          (byDate[date] ||= []).push(slot);
        }
      });

      setSlotsByDate(byDate);
      setCalendarDates(weekDates);
      setCurrentDateIdx(0);
      setSelectedSlot(null);
      setSmsRequested(false);
      setSmsCode("");
      setBookingResult(null);
      setSmsSent(null);
      setPhone("+7 (");
      setPhoneError(false);
      triedCodesRef.current.clear();
    } catch (e: unknown) {
      setApiError("Ошибка загрузки слотов: " + ((e as Error).message || "Unknown"));
    } finally {
      setLoading(false);
    }
  }

  function handlePhoneChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const formatted = formatPhoneInput(raw);
    setPhone(formatted);
    setPhoneError(!validatePhone(formatted));
  }

  async function requestSmsCode(): Promise<void> {
    if (!validatePhone(phone)) {
      setPhoneError(true);
      return;
    }
    setLoading(true);
    setApiError("");
    try {
      const newRequestId = uuidv4();
      setRequestId(newRequestId);
      const normPhone = normalizePhone(phone);
      const res = await fetch(CONFIRM_PHONE_PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: normPhone,
          method: "sms",
          request_id: newRequestId,
        }),
      });
      if (!res.ok) {
        const respText = await res.text();
        throw new Error(`status ${res.status}: ${respText}`);
      }
      setSmsRequested(true);
      setSmsCode("");
      setSmsCodeError(false);
      setSmsCodeHelper("");
      triedCodesRef.current.clear();
      attemptingRef.current = false;
      setSmsCodeLocked(false);
    } catch (e: unknown) {
      setApiError("Ошибка при отправке телефона: " + ((e as Error)?.message || "Unknown"));
    } finally {
      setLoading(false);
    }
  }

  async function confirmSmsCodeAndBook(codeArg?: string) {
    const code = codeArg ?? smsCode;
    log("CONFIRM start", {
      code,
      attempting: attemptingRef.current,
      locked: smsCodeLocked,
      tried: Array.from(triedCodesRef.current),
    });

    if (code.length !== 4 || !/^\d{4}$/.test(code)) {
      setSmsCodeError(true);
      setSmsCodeHelper("Введите 4 цифры");
      return;
    }

    if (attemptingRef.current) {
      log("CONFIRM blocked: attemptingRef true");
      return;
    }
    if (smsCodeLocked) {
      log("CONFIRM blocked: smsCodeLocked true");
      return;
    }
    if (triedCodesRef.current.has(code)) {
      log("CONFIRM blocked: code already tried");
      return;
    }

    attemptingRef.current = true;
    setSmsCodeLocked(true);
    setSmsCodeLoading(true);
    setSmsCodeError(false);
    setSmsCodeHelper("");
    setApiError("");

    const normPhone = normalizePhone(phone);

    try {
      // 1. Подтверждение SMS-кода и получение pass_token
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
      try {
        data = await res.json();
      } catch {
        /* ignore */
      }
      log("CONFIRM response", { status: res.status, data });

      const passToken: string | undefined =
        data.pass_token || (data.data && data.data.pass_token);

      if (!passToken) {
        triedCodesRef.current.add(code);
        setSmsCodeError(true);
        setSmsCodeHelper("Неверный код");
        setSmsCodeLocked(false);
        return;
      }

      // 2. Установка пароля (set_password)
      const setPasswordRes = await fetch(SET_PASSWORD_PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: normPhone,
          pass_token: passToken,
        }),
      });
      if (!setPasswordRes.ok) {
        const text = await setPasswordRes.text();
        throw new Error(`Ошибка установки пароля: ${text}`);
      }

      // 3. Получение профиля клиента
      const clientRes = await fetch(CLIENT_PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usertoken: passToken }),
      });
      if (!clientRes.ok) {
        const text = await clientRes.text();
        throw new Error(`Ошибка клиента: ${text}`);
      }
      await clientRes.json();

      if (!selectedSlot) throw new Error("Слот не выбран");

      // 4. Бронирование
      const bookRes = await fetch(BOOK_PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointment_id: selectedSlot.appointment_id,
          usertoken: passToken,
        }),
      });

      const contentType = bookRes.headers.get("content-type") || "";
      let bookData: any;
      if (contentType.includes("application/json")) {
        bookData = await bookRes.json();
      } else {
        const text = await bookRes.text();
        bookData = { raw: text };
      }
      if (!bookRes.ok) {
        throw new Error(
          bookData?.error || JSON.stringify(bookData) || "Ошибка бронирования"
        );
      }
      setBookingResult(bookData);

      // 5. SMS-подтверждение записи
      const appointment: BookingApiAppointment =
        bookData?.data?.data?.appointment || {};
      const customer: BookingApiCustomer =
        bookData?.data?.data?.customer || {};

      let fio = customer.client_name || "";
      if (!fio) {
        fio = `${customer.last_name || ""} ${customer.name || ""} ${customer.second_name || ""}`.trim();
      }
      let customerPhone = "";
      if (Array.isArray(customer.phone)) customerPhone = customer.phone[0];
      else if (typeof customer.phone === "string") customerPhone = customer.phone;

      const phoneNumber = normalizePhone(customerPhone);
      const dateObj = appointment.date_time
        ? new Date(appointment.date_time.replace(" ", "T"))
        : null;

      const dateStr = dateObj
        ? dateObj.toLocaleDateString("ru-RU", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })
        : "";
      const timeStr = dateObj
        ? dateObj.toLocaleTimeString("ru-RU", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "";

      if (
        phoneNumber.length === 11 &&
        fio.replace(/\s/g, "").length > 0 &&
        dateStr &&
        timeStr
      ) {
        const smsRes = await sendSmsAramba({
          phone: phoneNumber,
          fio,
          date: dateStr,
          time: timeStr,
        });
        setSmsSent(
          smsRes && smsRes.status === "Enroute"
            ? "SMS отправлено"
            : "Ошибка SMS: " + (smsRes?.error || smsRes?.text || "Неизвестно")
        );
      } else {
        setSmsSent("SMS не отправлено (нет данных)");
      }
    } catch (e: unknown) {
      setApiError(
        "Ошибка при финальном бронировании: " + ((e as Error)?.message || "Unknown")
      );
      setSmsCodeError(true);
      setSmsCodeHelper("Ошибка. Попробуйте другой код.");
      setSmsCodeLocked(false);
      triedCodesRef.current.add(smsCode);
    } finally {
      setSmsCodeLoading(false);
      attemptingRef.current = false;
      log("CONFIRM end", {
        code,
        attempting: attemptingRef.current,
        locked: smsCodeLocked,
        tried: Array.from(triedCodesRef.current),
      });
    }
  }

  function resetAll(): void {
    setSlotsByDate({});
    setCalendarDates([]);
    setCurrentDateIdx(0);
    setSelectedSlot(null);
    setPhone("+7 (");
    setSmsRequested(false);
    setSmsCode("");
    setRequestId("");
    setBookingResult(null);
    setSmsSent(null);
    setApiError("");
    setSmsCodeError(false);
    setSmsCodeHelper("");
    setSmsCodeLoading(false);
    setSmsCodeLocked(false);
    setPhoneError(false);
    attemptingRef.current = false;
    triedCodesRef.current.clear();
    fetchWeekSlots();
  }

  return (
    <Container className="main-container" maxWidth="sm">
      <Paper className="paper" elevation={10}>
        <Typography className="header-title" variant="h4" align="center">
          Онлайн-бронирование
        </Typography>
        <Typography className="header-subtitle" align="center">
          Дворец водных видов спорта
        </Typography>

        {apiError && (
          <Alert className="alert-error" severity="error">
            {apiError}
          </Alert>
        )}

        {!selectedSlot && (
          <SlotPicker
            slotsByDate={slotsByDate}
            calendarDates={calendarDates}
            currentDateIdx={currentDateIdx}
            setCurrentDateIdx={setCurrentDateIdx}
            selectedSlot={selectedSlot}
            setSelectedSlot={setSelectedSlot}
            isLoading={loading}
          />
        )}

        {selectedSlot && !smsRequested && (
          <Box
            style={{
              marginTop: 32,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
            }}
          >
            <Box
              style={{
                padding: 16,
                background: "#fafdff",
                borderRadius: 12,
                boxShadow: "0 2px 14px #e0f2ff66",
                marginBottom: 16,
              }}
            >
              <Typography
                style={{
                  fontWeight: 700,
                  fontSize: 20,
                  color: "#31628c",
                  marginBottom: 8,
                  letterSpacing: ".02em",
                }}
              >
                Время:{" "}
                <b>
                  {new Date(
                    selectedSlot.start_date.replace(" ", "T")
                  ).toLocaleTimeString("ru-RU", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </b>
              </Typography>
            </Box>
            <input
              className="phone-input"
              value={phone}
              onChange={handlePhoneChange}
              placeholder="+7 (999) 999-99-99"
              type="tel"
              disabled={loading}
            />
            {phoneError && (
              <div style={{ color: "#d32f2f", fontWeight: 700, marginBottom: 8 }}>
                Введите корректный номер
              </div>
            )}
            <button
              className="button-main"
              disabled={loading || !validatePhone(phone)}
              onClick={requestSmsCode}
            >
              Получить SMS-код
            </button>
            <button
              className="button-secondary"
              onClick={resetAll}
              type="button"
            >
              Назад к выбору времени
            </button>
          </Box>
        )}

        {selectedSlot && smsRequested && !bookingResult && (
          <Box style={{ marginTop: 32 }}>
            <Typography
              align="center"
              style={{ fontWeight: 700, fontSize: 20, color: "#31628c", marginBottom: 8 }}
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
                onComplete={confirmSmsCodeAndBook}
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
              <button
                className="button-secondary"
                onClick={resetAll}
                type="button"
              >
                Назад к выбору времени
              </button>
            </Box>
          </Box>
        )}

        {bookingResult && (
          <Box className="booking-success">
            <CheckCircleIcon className="check-icon" />
            <Typography
              className="booking-title"
              variant="h4"
              gutterBottom
            >
              Бронирование успешно!
            </Typography>
            {bookingResult?.data?.data?.appointment &&
              bookingResult?.data?.data?.customer && (
                <Typography
                  className="booking-details"
                  variant="h6"
                >
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
                        bookingResult.data.data.appointment.date_time.replace(
                          " ",
                          "T"
                        )
                      ).toLocaleDateString("ru-RU", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })} в ${new Date(
                        bookingResult.data.data.appointment.date_time.replace(
                          " ",
                          "T"
                        )
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
                severity={
                  smsSent.startsWith("SMS отправлено")
                    ? "success"
                    : "warning"
                }
              >
                {smsSent}
              </Alert>
            )}
            <button
              className="new-booking-button"
              onClick={resetAll}
              type="button"
            >
              Новое бронирование
            </button>
          </Box>
        )}
      </Paper>
    </Container>
  );
};

export default App;