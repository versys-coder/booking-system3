import React, { useState, useEffect, useRef, ChangeEvent } from "react";
import { Container, Paper, Typography, Box, CircularProgress, Alert } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { v4 as uuidv4 } from "uuid";
import SlotPicker from "./SlotPicker";
import SmsCodeInput from "./SmsCodeInput";
import {
  fetchSlots,
  confirmPhone,
  setPassword,
  getClient,
  bookSlot,
  sendSmsAramba,
} from "../../../api"; // adjust path if your api.ts is in another place
import "./booking.css";

const TARGET_SERVICE_ID = "9672bb23-7060-11f0-a902-00583f11e32d";

interface SlotApi {
  appointment_id: string;
  start_date: string; // "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DDTHH:MM:SS"
  service_id: string;
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
interface BookingResult {
  data?: any;
  error?: string;
  raw?: string;
  [key: string]: any;
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

const BookingApp: React.FC = () => {
  // State
  const [slotsByDate, setSlotsByDate] = useState<Record<string, SlotApi[]>>({});
  const [calendarDates, setCalendarDates] = useState<string[]>([]);
  const [currentDateIdx, setCurrentDateIdx] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string>("");

  const [selectedSlot, setSelectedSlot] = useState<SlotApi | null>(null);
  const [showPhoneStage, setShowPhoneStage] = useState(false);
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
      const data = await fetchSlots();
      const filteredSlots: SlotApi[] = Array.isArray(data.slots)
        ? data.slots.filter((slot: SlotApi) => slot.service_id === TARGET_SERVICE_ID)
        : [];

      // Формируем дни
      const byDate: Record<string, SlotApi[]> = {};
      filteredSlots.forEach((slot: SlotApi) => {
        const date = slot.start_date.replace(" ", "T").split("T")[0];
        (byDate[date] ||= []).push(slot);
      });

      const weekDates = Object.keys(byDate).sort();
      setSlotsByDate(byDate);
      setCalendarDates(weekDates);
      setCurrentDateIdx(0);
      setSelectedSlot(null);
      setShowPhoneStage(false);
      setSmsRequested(false);
      setSmsCode("");
      setBookingResult(null);
      setSmsSent(null);
      setPhone("+7 (");
      setPhoneError(false);
      triedCodesRef.current.clear();
    } catch (e: any) {
      setApiError("Ошибка загрузки слотов: " + (e?.message || "Unknown"));
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

      await confirmPhone(normPhone, newRequestId);

      setSmsRequested(true);
      setSmsCode("");
      setSmsCodeError(false);
      setSmsCodeHelper("");
      triedCodesRef.current.clear();
      attemptingRef.current = false;
      setSmsCodeLocked(false);
    } catch (e: any) {
      setApiError("Ошибка при отправке телефона: " + (e?.message || "Unknown"));
    } finally {
      setLoading(false);
    }
  }

  async function confirmSmsCodeAndBook(codeArg?: string) {
    const code = codeArg ?? smsCode;

    if (code.length !== 4 || !/^\d{4}$/.test(code)) {
      setSmsCodeError(true);
      setSmsCodeHelper("Введите 4 цифры");
      return;
    }
    if (attemptingRef.current || smsCodeLocked || triedCodesRef.current.has(code)) {
      return;
    }

    attemptingRef.current = true;
    setSmsCodeLocked(true);
    setSmsCodeError(false);
    setSmsCodeHelper("");
    setApiError("");
    setSmsCodeLoading(true);

    const normPhone = normalizePhone(phone);

    try {
      const passToken = await setPassword(normPhone, code, requestId);
      if (!passToken) {
        triedCodesRef.current.add(code);
        setSmsCodeError(true);
        setSmsCodeHelper("Неверный код");
        setSmsCodeLocked(false);
        return;
      }
      await getClient(passToken);

      if (!selectedSlot) throw new Error("Слот не выбран");

      const bookData = await bookSlot(selectedSlot.appointment_id, passToken);
      setBookingResult(bookData);

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
    } catch (e: any) {
      setApiError(
        "Ошибка при финальном бронировании: " + (e?.message || "Unknown")
      );
      setSmsCodeError(true);
      setSmsCodeHelper("Ошибка. Попробуйте другой код.");
      setSmsCodeLocked(false);
      triedCodesRef.current.add(smsCode);
    } finally {
      setSmsCodeLoading(false);
      attemptingRef.current = false;
    }
  }

  function resetAll(): void {
    setSlotsByDate({});
    setCalendarDates([]);
    setCurrentDateIdx(0);
    setSelectedSlot(null);
    setShowPhoneStage(false);
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
    <Container className="booking-main-container" maxWidth="lg">
      <Paper className="booking-paper" elevation={10}>
        <Typography className="booking-header-title" variant="h4" align="center">
        </Typography>
        <Typography className="booking-header-subtitle" align="center">
        </Typography>
        {apiError && (
          <Alert className="booking-alert-error" severity="error" sx={{ mt: 2 }}>
            {apiError}
          </Alert>
        )}

        {!selectedSlot && !showPhoneStage && (
          <SlotPicker
            slotsByDate={slotsByDate}
            calendarDates={calendarDates}
            currentDateIdx={currentDateIdx}
            setCurrentDateIdx={setCurrentDateIdx}
            selectedSlot={selectedSlot}
            setSelectedSlot={setSelectedSlot}
            isLoading={loading}
            onBook={(slot) => {
              setSelectedSlot(slot);
              setShowPhoneStage(true);
            }}
          />
        )}

        {/* Phone stage */}
        {selectedSlot && showPhoneStage && !smsRequested && (
          <Box className="phone-stage">
            <Box className="selected-slot-box">
              <Typography className="selected-slot-time">
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
              <div className="field-error">Введите корректный номер</div>
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

        {/* SMS input stage */}
        {selectedSlot && showPhoneStage && smsRequested && !bookingResult && (
          <Box className="sms-stage">
            <Typography
              align="center"
              className="sms-enter-title"
            >
              Введите код из SMS
            </Typography>
            <Box className="sms-stage-inner">
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
                <Box className="sms-loading">
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

        {/* Success */}
        {bookingResult && (
          <Box className="booking-success">
            <CheckCircleIcon className="check-icon" />
            <Typography className="booking-title" variant="h4" gutterBottom>
              Бронирование успешно!
            </Typography>
            {bookingResult?.data?.data?.appointment &&
              bookingResult?.data?.data?.customer && (
                <Typography className="booking-details" variant="h6">
                  {bookingResult.data.data.customer["client_name"] as string}{" "}
                  записан на занятие {bookingResult.data.data.appointment.title}
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
                severity={smsSent.startsWith("SMS отправлено") ? "success" : "warning"}
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

export default BookingApp;