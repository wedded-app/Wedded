import type { EventNeed } from '@/data/reference';
import type { Translate } from '@/features/vendors/profile-format';
import { localized } from '@/i18n/localized';

/** The essentials not booked yet for an event, by name, in lowercase for a sentence. */
export function unbookedNames(essential: EventNeed[], booked: string[]): string[] {
  return essential
    .filter((need) => !booked.includes(need.categorySlug))
    .map((need) => localized(need.name).toLowerCase());
}

/**
 * What an event still needs, in words instead of a count (the final look,
 * 2026-10-23: no "12 of 22 booked"): "All set", "To book: DJ, cake", or
 * "To book: mehndi artist and 5 more".
 */
export function stillNeedsText(names: string[], t: Translate): string {
  if (names.length === 0) return t('home.events.allSet');
  if (names.length <= 2) return t('home.events.toBook', { what: names.join(', ') });
  return t('home.events.toBookMore', { what: names[0], count: names.length - 1 });
}

/**
 * Who's booked for an event, in the order of its list of needs: the
 * vendor's name where the booking names one (those first), else the kind
 * of vendor in lowercase. A kind the event doesn't list shows only by its
 * vendor's name.
 */
export function bookedNames(
  needs: EventNeed[],
  booked: string[],
  vendorFor: (categorySlug: string) => string | null,
): string[] {
  const order = (slug: string) => {
    const index = needs.findIndex((need) => need.categorySlug === slug);
    return index === -1 ? needs.length : index;
  };
  const named: string[] = [];
  const kinds: string[] = [];
  for (const slug of [...booked].sort((a, b) => order(a) - order(b))) {
    const vendor = vendorFor(slug);
    const need = needs.find((n) => n.categorySlug === slug);
    if (vendor) named.push(vendor);
    else if (need) kinds.push(localized(need.name).toLowerCase());
  }
  return [...named, ...kinds];
}

/** "Booked: Royal Orchard, caterer", or "Booked: Royal Orchard and 3 more". Null when nothing is. */
export function bookedText(names: string[], t: Translate): string | null {
  if (names.length === 0) return null;
  if (names.length <= 2) return t('planner.ticket.booked', { names: names.join(', ') });
  return t('planner.ticket.bookedMore', { names: names[0], count: names.length - 1 });
}
