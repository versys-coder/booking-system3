import { http } from "./http";

/**
 * Слот загруженности бассейна из /api/pool-workload.
 * Этот ответ строится ИСКЛЮЧИТЕЛЬНО по расписанию (без ClickHouse и внешнего счетчика клуба).
 */
export interface PoolWorkloadSlot {
  date: string;        // ISO, напр. 2025-11-04
  hour: number;        // 7..21
  freePlaces: number;  // свободные места (учитывая занятые дорожки, персональные, перерыв)
  // Для гистограммы/совместимости
  isBreak?: boolean;
  totalPlaces?: number;
  freeLanes?: number;
  busyLanes?: number;
  totalLanes?: number;
  current?: number | null; // в этой версии backend возвращает null
}

export interface PoolWorkloadResponse {
  slots: PoolWorkloadSlot[];
  currentNow?: {
    date: string;
    hour: number;
    current: number | null;
    source: string;
  };
  meta?: {
    serverNowDate: string;
    serverNowHour: number;
    tzOffset: number;
    scheduleMode?: string;
    testRange?: { start: string; end: string };
  };
}

export interface FetchPoolWorkloadParams {
  poolId?: string | number; // резерв под несколько бассейнов
  dateFrom?: string;        // ISO YYYY-MM-DD
  dateTo?: string;          // ISO YYYY-MM-DD
  start_hour?: number;      // 7..21
  end_hour?: number;        // 7..21
}

/**
 * Запрашивает загруженность по расписанию из backend /api/pool-workload.
 */
export async function fetchPoolWorkload(params: FetchPoolWorkloadParams = {}): Promise<PoolWorkloadResponse> {
  const { data } = await http.get<PoolWorkloadResponse>("/api/pool-workload", { params });
  return data;
}