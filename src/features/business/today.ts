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
