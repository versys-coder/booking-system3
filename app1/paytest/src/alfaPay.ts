// src/alfaPay.ts
// Утилиты для общения с локальным backend (/api/pay/*)

async function apiFetch(url: string, options: any = {}, name = "") {
  console.log(`➡ [API] ${name} → ${url}`, options);
  const res = await fetch(url, {
    method: options.method || "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await res.text();
  try {
    const json = JSON.parse(text);
    console.log(`⬅ [API] ${name} OK:`, json);
    return json;
  } catch (e) {
    console.warn(`⬅ [API] ${name} RAW:`, text);
    return { ok: res.ok, status: res.status, statusText: res.statusText, body: text };
  }
}

const API_BASE = "/catalog/api-backend/api";

// ----------------------
// helper
// ----------------------
export function normalizeRub(v: any) {
  if (v === undefined || v === null || v === "") return 0;
  let s = String(v).replace(/\s+/g, "").replace(",", ".");
  const f = parseFloat(s);
  return isFinite(f) ? Math.round(f) : 0;
}

// ----------------------
// CREATE PAYMENT
// ----------------------
export async function createPayment(payload: {
  service_id: string;
  service_name: string;
  price: number | string;
  phone: string;
  email: string;
  back_url?: string;
}) {
  const body = {
    ...payload,
    price: normalizeRub(payload.price)
  };
  return await apiFetch(`${API_BASE}/pay/create`, { body }, "pay/create");
}

// ----------------------
// STATUS CHECK   (orderId only)
// ----------------------
export async function getStatusByOrderId(orderId: string) {
  return await apiFetch(
    `${API_BASE}/pay/status?orderId=${encodeURIComponent(orderId)}`,
    { method: "GET" },
    "pay/status(orderId)"
  );
}

// ----------------------
// MARK PAID (local only)
// ----------------------
export async function markPaid(orderId: string) {
  return await apiFetch(
    `${API_BASE}/pay/mark_paid?orderId=${encodeURIComponent(orderId)}`,
    { method: "POST" },
    "pay/mark_paid"
  );
}
