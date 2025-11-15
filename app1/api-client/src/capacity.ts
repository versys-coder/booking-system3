import { http } from "./http";

/**
 * Единый расчет доступности c учетом:
 * - MAX_CAPACITY
 * - занятые дорожки × LANE_CAPACITY (из расписания)
 * - продажи ОФД в текущем бакете (ClickHouse)
 * - внешняя текущая загрузка клуба (club_workload_quantity)
 */

export interface CapacityNowResponse {
  timestamp: string;             // ISO
  bucket: number | null;         // текущий бакет (часы по вашей логике) или null, если вне рабочего окна
  max_capacity: number;          // MAX_CAPACITY
  lane_capacity: number;         // LANE_CAPACITY
  lanes_reserved: number;        // занято дорожек (по расписанию)
  ofd_sales: number;             // продажи в текущем бакете (шт.)
  external_workload: number;     // внешняя текущая загрузка (шт.)
  available: number;             // расчетный остаток мест >= 0
  details?: Record<string, unknown>;
}

export interface CapacityDaySlot {
  date: string;                  // YYYY-MM-DD
  hour: number;                  // 7..21
  available: number;             // расчетный остаток мест на этот час
  ofd_sales: number;             // продажи за бакет, в который попадает этот час
  external_workload: number;     // внешняя загрузка на час
  lanes_reserved: number;        // занято дорожек на час
  lane_capacity: number;         // LANE_CAPACITY
  max_capacity: number;          // MAX_CAPACITY
}

export interface CapacityDayResponse {
  date: string;                  // YYYY-MM-DD
  slots: CapacityDaySlot[];
}

/**
 * Текущая доступность: GET /api/capacity/now
 */
export async function fetchCapacityNow() {
  const { data } = await http.get<CapacityNowResponse>("/api/capacity/now");
  return data;
}

/**
 * Почасовая сводка за день: GET /api/capacity/day?date=YYYY-MM-DD
 * Если date не передать — сервер возьмет сегодня (локально Asia/Yekaterinburg)
 */
export async function fetchCapacityDay(dateIso?: string) {
  const { data } = await http.get<CapacityDayResponse>("/api/capacity/day", {
    params: dateIso ? { date: dateIso } : undefined
  });
  return data;
}