/** Calendar helpers on ISO `YYYY-MM-DD` strings, in UTC so no timezone can shift a day. */

const MS_PER_DAY = 86_400_000;

export function dayNumber(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / MS_PER_DAY;
}

export function fromDayNumber(day: number): string {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

export const addDays = (iso: string, days: number): string => fromDayNumber(dayNumber(iso) + days);

export const daysBetween = (from: string, to: string): number => dayNumber(to) - dayNumber(from);

export const daysInMonth = (year: number, month: number): number => new Date(Date.UTC(year, month, 0)).getUTCDate();

export function parts(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split('-').map(Number);
  return { year, month, day };
}

export const todayIso = (): string => new Date().toISOString().slice(0, 10);
