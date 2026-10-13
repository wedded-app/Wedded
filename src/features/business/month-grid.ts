/** "2026-10-05" for a local date. */
export function isoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "2026-10" for the month that holds a date. */
export function isoMonth(date: Date): string {
  return isoDay(date).slice(0, 7);
}

/** The month after (or before, with -1) "2026-10". */
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number);
  return isoMonth(new Date(y, m - 1 + by, 1));
}

/**
 * A month as calendar weeks, Sunday first (as US calendars are): each week is
 * seven cells, null before the 1st and after the last day.
 */
export function monthWeeks(month: string): (string | null)[][] {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const days = new Date(y, m, 0).getDate();
  const cells: (string | null)[] = Array.from({ length: first.getDay() }, () => null);
  for (let d = 1; d <= days; d++) cells.push(isoDay(new Date(y, m - 1, d)));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export type DayStatus = 'open' | 'booked' | 'held';

/** Tapping a day moves it on: open, then booked, then held, then open again. */
export function nextStatus(status: DayStatus): DayStatus {
  return status === 'open' ? 'booked' : status === 'booked' ? 'held' : 'open';
}
