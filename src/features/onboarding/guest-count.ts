/**
 * "About how many guests?" counts in steps of 25; the plan keeps only the
 * band it falls in (the inquiry form's bands), which is what halls are
 * matched on. Pure, so tests can load it.
 */
import type { GuestBand } from '@/data/inquiries';

export const GUEST_STEP = 25;
export const MIN_GUESTS = 25;
export const MAX_GUESTS = 1000;
/** Where the count starts: about the size of a Punjabi wedding's biggest day. */
export const START_GUESTS = 300;

/** The band a count falls in: 100 is "50 to 100", 101 is "100 to 250". */
export function bandForCount(count: number): Exclude<GuestBand, 'not_sure'> {
  if (count < 50) return 'under_50';
  if (count <= 100) return '50_100';
  if (count <= 250) return '100_250';
  if (count <= 500) return '250_500';
  return '500_plus';
}

/** Where the count starts for a band they gave before (a search for "300 people"). */
export function countForBand(band: GuestBand | null): number {
  switch (band) {
    case 'under_50':
      return 25;
    case '50_100':
      return 75;
    case '100_250':
      return 200;
    case '500_plus':
      return 600;
    default:
      return START_GUESTS;
  }
}

/** One step up or down, kept between MIN_GUESTS and MAX_GUESTS. */
export function stepGuests(count: number, direction: 1 | -1): number {
  return Math.min(MAX_GUESTS, Math.max(MIN_GUESTS, count + direction * GUEST_STEP));
}
