// src/api/index.ts
// Функции для взаимодействия с backend API

const BASE_API_URL = process.env.REACT_APP_BASE_API_URL || "";

const SLOTS_PROXY_URL = `${BASE_API_URL}/api/slots`;
const CONFIRM_PHONE_PROXY_URL = `${BASE_API_URL}/api/confirm_phone`;
const SET_PASSWORD_PROXY_URL = `${BASE_API_URL}/api/set_password`;
const CLIENT_PROXY_URL = `${BASE_API_URL}/api/client`;
const BOOK_PROXY_URL = `${BASE_API_URL}/api/book`;
const ARAMBA_SMS_API_URL = `${BASE_API_URL}/api/sms`;

// Получить слоты на неделю
export async function fetchSlots(): Promise<any> {
  const res = await fetch(SLOTS_PROXY_URL, { method: "GET" });
  if (!res.ok) throw new Error("Ошибка получения слотов: " + res.status);
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await res.text();
    throw new Error(`Сервер вернул не JSON: ${text.substring(0, 300)}`);
  }
  return res.json();
}

// Запросить СМС-код (отправка телефона)
export async function confirmPhone(phone: string, request_id: string): Promise<void> {
  const res = await fetch(CONFIRM_PHONE_PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phone,
      method: "sms",
      request_id,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ошибка отправки телефона: status ${res.status}: ${text}`);
  }
}

// Подтвердить код и получить pass_token (и установить пароль)
export async function setPassword(
  phone: string,
  confirmation_code: string,
  request_id: string
): Promise<string> {
  // Подтверждение кода
  const res = await fetch(CONFIRM_PHONE_PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phone,
      confirmation_code,
      request_id,
      method: "sms",
    }),
  });
  let data: any = {};
  try {
    data = await res.json();
  } catch {
    // ignore
  }
  const passToken: string | undefined =
    data.pass_token || (data.data && data.data.pass_token);

  if (!passToken) {
    throw new Error("Неверный код");
  }

  // Установка пароля
  const setPasswordRes = await fetch(SET_PASSWORD_PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phone,
      pass_token: passToken,
    }),
  });
  if (!setPasswordRes.ok) {
    const text = await setPasswordRes.text();
    throw new Error(`Ошибка установки пароля: ${text}`);
  }

  return passToken;
}

// Получить профиль клиента
export async function getClient(usertoken: string): Promise<any> {
  const res = await fetch(CLIENT_PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usertoken }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ошибка получения клиента: ${text}`);
  }
  return res.json();
}

// Бронирование слота
export async function bookSlot(appointment_id: string, usertoken: string): Promise<any> {
  const res = await fetch(BOOK_PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appointment_id, usertoken }),
  });
  const contentType = res.headers.get("content-type") || "";
  let bookData: any;
  if (contentType.includes("application/json")) {
    bookData = await res.json();
  } else {
    const text = await res.text();
    bookData = { raw: text };
  }
  if (!res.ok) {
    throw new Error(
      bookData?.error || JSON.stringify(bookData) || "Ошибка бронирования"
    );
  }
  return bookData;
}

// Отправить SMS подтверждение
export async function sendSmsAramba({
  phone,
  fio,
  date,
  time,
}: {
  phone: string;
  fio: string;
  date: string;
  time: string;
}): Promise<any> {
  const body = {
    SenderId: "DVVS-EKB",
    UseRecepientTimeZone: "True",
    PhoneNumber: phone,
    Text: `${fio}, вы записаны на свободное плавание ${date} в ${time}.`,
  };
  const res = await fetch(ARAMBA_SMS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SMS API: ${res.status} ${text}`);
  }
  return res.json();
}