/**
 * The line Wed writes on a vendor's page, under its name (Fezy, 2026-11-11:
 * "there's never just an Ask ChatGPT button"): what this vendor means for
 * the family's event, from what the vendor told us and the family's plan,
 * never a promise. Pure, so tests can load it.
 */
import type { DateStatus } from '@/data/availability';
import type { HallFacts } from '@/data/vendors';

type Translate = (key: string, options?: Record<string, string | number>) => string;

export type WedLineFacts = {
  /** The family's event the page is about, by name. */
  event: string | null;
  /** About how many guests it has (the plan's band). */
  band: string | null;
  /** Whether the vendor is free that day, from its calendar. */
  status: DateStatus;
  hall: HallFacts;
};

/** The fewest and most guests in a band. */
const BANDS: Record<string, [number, number]> = {
  under_50: [1, 49],
  '50_100': [50, 100],
  '100_250': [101, 250],
  '250_500': [251, 500],
  '500_plus': [501, Infinity],
};

/** Two short sentences, the first in bold: "Fits your 100 to 250 guests." "It's hall only, so you'd bring a caterer." */
export function wedLine(t: Translate, f: WedLineFacts): { bold: string; rest: string } | null {
  const lines: string[] = [];
  if (f.event && (f.status === 'booked' || f.status === 'held')) {
    lines.push(t(`vendor.wed.${f.status}`, { event: f.event }));
  }
  const seats = f.hall.seatedCapacity;
  const band = f.band ? BANDS[f.band] : undefined;
  if (seats && band) {
    const guests = t(`inquiry.guestBands.${f.band}`);
    if (seats >= band[1]) lines.push(t('vendor.wed.fits', { guests }));
    else if (seats < band[0]) lines.push(t('vendor.wed.tooSmall', { seats, guests }));
    else lines.push(t('vendor.wed.seats', { seats }));
  } else if (seats) {
    lines.push(t('vendor.wed.seats', { seats }));
  }
  const kitchen = f.hall.inHouseCatering;
  const outside = f.hall.outsideCatering;
  if (kitchen === 'no') lines.push(t('vendor.wed.hallOnly'));
  else if ((kitchen === 'yes' || kitchen === 'optional') && outside === 'no') {
    lines.push(t('vendor.wed.allFood'));
  } else if (kitchen === 'yes' || kitchen === 'optional') {
    lines.push(t(outside === 'approved_list' ? 'vendor.wed.cooksList' : 'vendor.wed.cooks'));
  }
  if (lines.length === 0) return null;
  return { bold: lines[0], rest: lines.slice(1, 2).join(' ') };
}
