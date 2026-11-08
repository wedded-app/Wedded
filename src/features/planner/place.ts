import type { EventNeedsSection } from '@/data/reference';

/**
 * What an event's place says when it's at the family's home. It's saved as
 * the event's place, with no address: the wedding website shows the place
 * to anyone with its link, so a home address doesn't go there.
 */
export const AT_HOME = 'At home';

/** The vendor group (from the database) of halls, gurdwaras and other venues. */
export const VENUES_GROUP = 'venues';

/** Where an event is, as the time and place sheet asks it. */
export type PlaceKind = 'home' | 'venue';

/**
 * Which choice a saved place is: "At home" (or "Home", typed on the
 * invitation details) is Home, anything else a venue, and nothing yet is
 * null.
 */
export function placeKind(place: string | null | undefined): PlaceKind | null {
  const text = place?.trim().toLowerCase() ?? '';
  if (!text) return null;
  return text === 'home' || text === AT_HOME.toLowerCase() ? 'home' : 'venue';
}

/**
 * The place to save from the sheet: "At home" for Home, the venue's name
 * as typed (spaces tidied), or null when it's a venue with no name yet or
 * nothing is picked.
 */
export function placeToSave(kind: PlaceKind | null, venue: string): string | null {
  if (kind === 'home') return AT_HOME;
  if (kind === 'venue') return venue.trim().replace(/\s+/g, ' ') || null;
  return null;
}

/**
 * Each event's needs, without the halls and other venues for an event at
 * home: a dholki in the living room doesn't need a banquet hall. Events
 * elsewhere, or with no place yet, keep their whole list. Returns the same
 * object when nothing is at home.
 */
export function needsForPlaces(
  needsByEvent: Record<string, EventNeedsSection[]>,
  places: Record<string, string>,
): Record<string, EventNeedsSection[]> {
  let out = needsByEvent;
  for (const [slug, place] of Object.entries(places)) {
    const sections = needsByEvent[slug];
    if (!sections || placeKind(place) !== 'home') continue;
    if (out === needsByEvent) out = { ...needsByEvent };
    out[slug] = sections
      .map((section) => ({
        ...section,
        needs: section.needs.filter((need) => need.groupSlug !== VENUES_GROUP),
      }))
      .filter((section) => section.needs.length > 0);
  }
  return out;
}

/**
 * The venue booked for an event (a hall, a gurdwara), by name, to fill in
 * when the family says it's at a venue: the first of the event's venue
 * needs with a vendor booked. Null when none is.
 */
export function bookedVenueName(
  needs: { categorySlug: string; groupSlug: string }[],
  eventSlug: string,
  bookedVendors: Record<string, { name: string }>,
): string | null {
  for (const need of needs) {
    if (need.groupSlug !== VENUES_GROUP) continue;
    const vendor = bookedVendors[`${eventSlug}/${need.categorySlug}`];
    if (vendor) return vendor.name;
  }
  return null;
}
