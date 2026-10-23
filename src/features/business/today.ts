import type { DayMark, MonthMarks } from '@/data/vendor-self';

/** The yyyy-mm after a yyyy-mm-dd's month. */
export function nextMonth(day: string): string {
  const [year, month] = day.split('-').map(Number);
  return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;
}

/** The next booked or held days from today on, soonest first, for Today's "Coming up". */
export function upcomingDays(
  months: (MonthMarks | undefined)[],
  today: string,
  limit = 3,
): { day: string; marks: DayMark[] }[] {
  return months
    .flatMap((marks) => Object.entries(marks ?? {}))
    .filter(([day]) => day >= today)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, limit)
    .map(([day, marks]) => ({ day, marks }));
}

/** Seven yyyy-mm-dd days from today on, for Today's week strip. */
export function weekDays(today: string, count = 7): string[] {
  const start = new Date(`${today}T12:00:00Z`);
  return Array.from({ length: count }, (_, i) => {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + i);
    return day.toISOString().slice(0, 10);
  });
}

/** Every loaded month's marks in one map. */
export function mergeMonths(months: (MonthMarks | undefined)[]): MonthMarks {
  return Object.assign({}, ...months.map((marks) => marks ?? {}));
}

/** The first day from today on with a booking on it (all day or part), or null. */
export function nextBooking(months: (MonthMarks | undefined)[], today: string): string | null {
  return (
    upcomingDays(months, today, 400).find(({ marks }) =>
      marks.some((mark) => mark.status === 'booked'),
    )?.day ?? null
  );
}

/** The family who has waited longest for a reply: the oldest lead not replied to. */
export function oldestWaiting<T extends { createdAt: string; replied: boolean }>(
  leads: T[],
): T | null {
  return leads
    .filter((lead) => !lead.replied)
    .reduce<T | null>(
      (oldest, lead) => (!oldest || lead.createdAt < oldest.createdAt ? lead : oldest),
      null,
    );
}
