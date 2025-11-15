export interface PoolWorkloadSlot {
  date: string;          // '2025-08-17'
  hour: number;          // 7..21
  current: number | null;
  freeLanes: number;
  busyLanes: number;
  totalLanes: number;
  freePlaces: number;
  totalPlaces: number;
}

export interface PoolWorkloadResponse {
  slots: PoolWorkloadSlot[];
}

export interface FetchPoolWorkloadParams {
  start_date?: string;
  end_date?: string;
  start_hour?: number;
  end_hour?: number;
  // для будущего можно добавить abort сигнал
}

export async function fetchPoolWorkload(params: FetchPoolWorkloadParams = {}, signal?: AbortSignal): Promise<PoolWorkloadResponse> {
  const qs = new URLSearchParams();
  if (params.start_date) qs.set('start_date', params.start_date);
  if (params.end_date) qs.set('end_date', params.end_date);
  if (typeof params.start_hour === 'number') qs.set('start_hour', String(params.start_hour));
  if (typeof params.end_hour === 'number') qs.set('end_hour', String(params.end_hour));

  const url = '/api/pool-workload' + (qs.toString() ? `?${qs.toString()}` : '');
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`Pool workload request failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}