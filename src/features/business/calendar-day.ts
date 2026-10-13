import type { DayMark } from '@/data/vendor-self';

/** How a day shows on the vendor's calendar. */
export type DayLook = 'open' | 'booked' | 'held' | 'partBooked' | 'partHeld';

/**
 * One look for a day's marks: an all-day mark wins; otherwise a morning or
 * evening mark makes it part of the day (booked when any part is booked).
 */
export function dayLook(marks: DayMark[]): DayLook {
  const allDay = marks.find((mark) => mark.part === 'all_day');
  if (allDay) return allDay.status;
  if (marks.some((mark) => mark.status === 'booked')) return 'partBooked';
  if (marks.length > 0) return 'partHeld';
  return 'open';
}
