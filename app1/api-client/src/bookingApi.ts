/* Minimal API adapter used by app1 BookingApp.
   Adjust API_BASE to your backend. This module mirrors the functions used in app:
   - fetchSlots
   - confirmPhone
   - setPassword
   - getClient
   - bookSlot
   - sendSmsAramba

   The implementation is defensive and returns parsed JSON. Adapt endpoints to your backend.
*/

const DEFAULT_API_BASE = "/catalog/api-backend/api"; // adjust if your backend path differs

function apiUrl(path: string) {
  // ensure leading slash
  const base = (window as any).__PW_API_BASE__ || DEFAULT_API_BASE;
  if (!base) return path;
  try {
    // if path already absolute, return
    if (/^https?:\/\//.test(path)) return path;
    return base.replace(/\/+$/, "") + (path.startsWith("/") ? path : "/" + path);
  } catch {
    return path;
  }
}

async function parseJsonOrThrow(res: Response) {
  const text = await res.text();
  try {
    const j = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const errMsg = (j && j.message) || res.statusText || "HTTP error";
      throw new Error(errMsg + " (" + res.status + ")");
    }
    return j;
  } catch (e) {
    if (res.ok) return text ? JSON.parse(text) : null;
    throw e;
  }
}

/** Fetch available slots for a given service / pool (simplified) */
export async function fetchSlots(serviceId?: string, dateFrom?: string) {
  const q = new URLSearchParams();
  if (serviceId) q.set("service_id", serviceId);
  if (dateFrom) q.set("from", dateFrom);
  const url = apiUrl("/slots" + (q.toString() ? "?" + q.toString() : ""));
  const res = await fetch(url, { cache: "no-store" });
  return await parseJsonOrThrow(res);
}

/** Request SMS / confirm phone — backend should return request_id or equivalent */
export async function confirmPhone(phone: string) {
  const url = apiUrl("/confirm-phone");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  return await parseJsonOrThrow(res);
}

/** setPassword / verify code — should return passToken on success (string) */
export async function setPassword(phone: string, code: string, requestId?: string) {
  const url = apiUrl("/set-password");
  const body: any = { phone, code };
  if (requestId) body.request_id = requestId;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await parseJsonOrThrow(res);
  // if backend returns token under different prop - adapt
  if (!j) return null;
  if (typeof j === "string") return j;
  return j.access_token || j.token || j.passToken || j.pass_token || j.data?.token || null;
}

/** getClient - returns client info when passToken provided */
export async function getClient(passToken: string) {
  const url = apiUrl("/client/me");
  const res = await fetch(url, {
    headers: { Authorization: passToken ? `Bearer ${passToken}` : "" },
  });
  return await parseJsonOrThrow(res);
}

/** bookSlot */
export async function bookSlot(appointment_id: string, passToken?: string) {
  const url = apiUrl("/book-slot");
  const body = { appointment_id };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(passToken ? { Authorization: `Bearer ${passToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return await parseJsonOrThrow(res);
}

/** sendSmsAramba - send SMS via gateway (optional). The payload contains phone, fio, date, time */
export async function sendSmsAramba(payload: { phone: string; fio?: string; date?: string; time?: string }) {
  const url = apiUrl("/sms/send");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return await parseJsonOrThrow(res);
}

export default {
  fetchSlots,
  confirmPhone,
  setPassword,
  getClient,
  bookSlot,
  sendSmsAramba,
};