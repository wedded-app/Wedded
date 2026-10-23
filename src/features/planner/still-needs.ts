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
