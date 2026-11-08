/**
 * What the Vendors tab shows (browse first, 2026-11-08): the kinds of vendor
 * in Browse categories, the kinds that get a shelf, and the search on All
 * categories. Pure, so it's tested on its own.
 */
import type { CategoryGroup, EventNeed, NeedsByEvent } from '@/data/reference';
import { firstNeedsFor, VENUE_GROUP } from '@/features/home/book-first';
import { essentialNeeds } from '@/features/planner/plan-helpers';
import { localized } from '@/i18n/localized';

/**
 * Browse categories: the kinds of vendor these events need, the hall first,
 * then the kinds the most events need (a photographer at eight events before
 * a decorator at three), several from a group when the events need them
 * (DJ and dhol). When the events name too few, the database's own order
 * fills the row: the first kind of each group, then the rest.
 */
export function browseKinds(
  events: string[],
  needs: NeedsByEvent,
  groups: CategoryGroup[],
  limit = 12,
): EventNeed[] {
  const kinds = new Map<string, { need: EventNeed; events: number; first: number }>();
  for (const event of events) {
    for (const need of essentialNeeds(needs[event])) {
      const seen = kinds.get(need.categorySlug);
      if (seen) seen.events += 1;
      else kinds.set(need.categorySlug, { need, events: 1, first: kinds.size });
    }
  }
  const ranked = [...kinds.values()].sort((a, b) => b.events - a.events || a.first - b.first);
  const hall = ranked.find((kind) => kind.need.groupSlug === VENUE_GROUP);
  const shown = (hall ? [hall, ...ranked.filter((kind) => kind !== hall)] : ranked).map(
    (kind) => kind.need,
  );

  const fill = [
    ...groups.flatMap((group) => group.categories.slice(0, 1)),
    ...groups.flatMap((group) => group.categories.slice(1)),
  ];
  for (const category of fill) {
    if (shown.length >= limit) break;
    if (shown.some((need) => need.categorySlug === category.slug)) continue;
    shown.push({ categorySlug: category.slug, name: category.name, groupSlug: category.groupSlug });
  }
  return shown.slice(0, limit);
}

/**
 * The shelves: what's still to book, one kind per group (the hall, not every
 * kind of venue), the venue first, then the groups these events need most.
 * A kind booked for an event doesn't count for that event, so once the hall
 * is booked everywhere it's needed, its shelf goes.
 */
export function shelfKinds(
  events: string[],
  needs: NeedsByEvent,
  booked: Record<string, string[]>,
  limit = 4,
): EventNeed[] {
  const open: NeedsByEvent = {};
  for (const event of events) {
    const done = booked[event] ?? [];
    open[event] = (needs[event] ?? []).map((section) => ({
      ...section,
      needs: section.needs.filter((need) => !done.includes(need.categorySlug)),
    }));
  }
  return firstNeedsFor(events, open, limit).map(({ categorySlug, name, groupSlug }) => ({
    categorySlug,
    name,
    groupSlug,
  }));
}

/** True for the hall shelf, which the tab shows bigger and first. */
export function isVenue(need: EventNeed): boolean {
  return need.groupSlug === VENUE_GROUP;
}

/**
 * The search on All categories: the kinds whose name or another name for
 * them (aliases: "mua" for makeup, "haar" for florist) has the typed text;
 * a group whose own name matches keeps every kind; groups left empty go.
 */
export function filterGroups(
  groups: CategoryGroup[],
  aliases: Record<string, string[]>,
  typed: string,
): CategoryGroup[] {
  const text = typed.trim().toLowerCase();
  if (!text) return groups;
  const has = (value: string) => value.toLowerCase().includes(text);
  return groups
    .map((group) =>
      has(localized(group.name))
        ? group
        : {
            ...group,
            categories: group.categories.filter(
              (category) =>
                has(localized(category.name)) || (aliases[category.slug] ?? []).some(has),
            ),
          },
    )
    .filter((group) => group.categories.length > 0);
}
