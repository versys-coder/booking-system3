export const HOUR_START = 7;
export const HOUR_END = 21;
export const allHours: number[] = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);

/**
 * Перерыв 12:00 в будни (как у вас в виджете).
 */
export function isBreakHour(dateIso: string | undefined, hour: number) {
  if (!dateIso || hour !== 12) return false;
  const dow = new Date(dateIso).getDay();
  return dow >= 1 && dow <= 5; // Пн..Пт
}