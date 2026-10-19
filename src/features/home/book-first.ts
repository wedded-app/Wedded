/**
 * Book these first, on Home before there's a plan: which kinds of vendor to
 * show, and the words on each card. Pure, so it's tested on its own.
 */
import type { PriceUnit } from '@/components/vendor-card';
import type { EventNeed, HomeSection, NeedsByEvent } from '@/data/reference';
import { essentialNeeds } from '@/features/planner/plan-helpers';

// The venue sets the date, so it's booked before anything else
const VENUE_GROUP = 'venues';

export type FirstNeed = EventNeed & {
  /** How many of the main events list it as essential. */
  events: number;
};

/**
 * The kinds of vendor to book first: one per group (the hall, not every
 * kind of venue), the venue first, then the groups the main events need
 * most, so a photographer needed at eight events comes before a decorator
 * needed at three. Within a group, the kind most events need; ties go to
 * whichever comes up first in ceremony order.
 */
export function bookFirstNeeds(
  sections: HomeSection[],
  needs: NeedsByEvent,
  limit = 5,
): FirstNeed[] {
  const core = sections.flatMap((section) => section.events).filter((event) => event.isCore);
  const kinds = new Map<string, { need: EventNeed; events: number; first: number }>();
  for (const event of core) {
    for (const need of essentialNeeds(needs[event.slug])) {
      const seen = kinds.get(need.categorySlug);
      if (seen) seen.events += 1;
      else kinds.set(need.categorySlug, { need, events: 1, first: kinds.size });
    }
  }

  const groups = new Map<
    string,
    { best: { need: EventNeed; events: number; first: number }; total: number }
  >();
  for (const kind of kinds.values()) {
    const group = groups.get(kind.need.groupSlug);
    if (!group) {
      groups.set(kind.need.groupSlug, { best: kind, total: kind.events });
      continue;
    }
    group.total += kind.events;
    if (kind.events > group.best.events) group.best = kind;
  }

  return [...groups.entries()]
    .sort(([slugA, a], [slugB, b]) => {
      if (slugA === VENUE_GROUP) return -1;
      if (slugB === VENUE_GROUP) return 1;
      return b.total - a.total || a.best.first - b.best.first;
    })
    .slice(0, limit)
    .map(([, group]) => ({ ...group.best.need, events: group.best.events }));
}

type Priced = { startingPrice: { amount: number; unit?: PriceUnit } | null };

/**
 * The lowest starting price among vendors of one kind, in the way most of
 * them price (a caterer's per plate, not the one who quotes per event), so
 * "from $55 a plate" isn't set against "$4,000 an event".
 */
export function cheapestPrice(vendors: Priced[]): { amount: number; unit?: PriceUnit } | null {
  const priced = vendors.flatMap((vendor) => (vendor.startingPrice ? [vendor.startingPrice] : []));
  if (priced.length === 0) return null;
  const counts = new Map<string, number>();
  for (const price of priced) {
    const unit = price.unit ?? '';
    counts.set(unit, (counts.get(unit) ?? 0) + 1);
  }
  const common = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  return priced
    .filter((price) => (price.unit ?? '') === common)
    .reduce((low, price) => (price.amount < low.amount ? price : low));
}

/** "2027-06-12" as "Jun 12". */
export function shortDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
    new Date(year, month - 1, day),
  );
}
