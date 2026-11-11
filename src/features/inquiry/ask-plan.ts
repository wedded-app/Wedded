/**
 * Which of the family's events a vendor is most likely for: the date ticket
 * on a vendor's page and the event Ask for a quote starts with. Pure, so
 * tests can load it.
 */
import type { GuestBand } from '@/data/inquiries';
import type { EventNeedsSection } from '@/data/reference';

import { GUEST_BANDS } from './inquiry-helpers';

/** How big an event is, from its guest band: bigger is higher, unknown is lowest. */
function size(band: string | undefined): number {
  if (!band || band === 'not_sure') return -1;
  return GUEST_BANDS.indexOf(band as GuestBand);
}

// When sizes tie, the wedding day and what follows it are the big ones
const PHASE_RANK: Record<string, number> = { wedding_day: 3, after: 2, before: 1 };

type Event = { slug: string; phase?: string; isCore?: boolean };

/** Bigger first, then the wedding day, then after it, then a main event; else ceremony order. */
function bigger(a: Event, b: Event, guests: Record<string, string> | undefined): boolean {
  const sizes = [size(guests?.[a.slug]), size(guests?.[b.slug])];
  if (sizes[0] !== sizes[1]) return sizes[0] > sizes[1];
  const phases = [PHASE_RANK[a.phase ?? ''] ?? 0, PHASE_RANK[b.phase ?? ''] ?? 0];
  if (phases[0] !== phases[1]) return phases[0] > phases[1];
  return !!a.isCore && !b.isCore;
}

/**
 * The event this vendor is most likely for, among the family's events (in
 * ceremony order): the one they came from, if it needs this kind of vendor;
 * else the biggest event that needs it (a hall is for the Reception, not
 * the Sangeet, when both list one), essential before nice to have. With no
 * guest counts, the wedding day and the events after it come before the
 * ones leading up to it. The event they came from is used when nothing
 * needs this kind; otherwise none.
 */
export function likelyEvent(
  chosen: Event[],
  needsByEvent: Record<string, EventNeedsSection[] | undefined>,
  categorySlugs: string[],
  guests: Record<string, string> | undefined,
  fromEvent?: string | null,
): string | null {
  const listed = (slug: string, importance: string) =>
    (needsByEvent[slug] ?? []).some(
      (section) =>
        section.importance === importance &&
        section.needs.some((need) => categorySlugs.includes(need.categorySlug)),
    );
  const needsIt = (slug: string) => listed(slug, 'essential') || listed(slug, 'nice_to_have');
  const came = fromEvent ? chosen.find((event) => event.slug === fromEvent) : undefined;
  if (came && needsIt(came.slug)) return came.slug;
  for (const importance of ['essential', 'nice_to_have']) {
    const fits = chosen.filter((event) => listed(event.slug, importance));
    if (fits.length === 0) continue;
    return fits.reduce((best, event) => (bigger(event, best, guests) ? event : best)).slug;
  }
  return came?.slug ?? null;
}
