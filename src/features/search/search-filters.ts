/**
 * Search filters for results lists (docs/RESEARCH_GROWTH.md #4): guest
 * capacity, a price ceiling, a language and the order. Kept in memory for the
 * session only, so a filter set weeks ago never quietly hides vendors. The
 * /filters sheet sets them; results pass them to useVendorSearch().
 */
import { useSyncExternalStore } from 'react';

export type SearchSort = 'distance' | 'price_low' | 'founding';

export type SearchFilters = {
  /** Venues that seat at least this many. */
  minGuests: number | null;
  /** A shown starting price at or under this, in dollars. */
  maxPrice: number | null;
  /** A code from the languages table, or any. */
  language: string | null;
  /** Leave out vendors booked all day on this yyyy-mm-dd date. */
  availableOn: string | null;
  sort: SearchSort;
};

export const NO_FILTERS: SearchFilters = {
  minGuests: null,
  maxPrice: null,
  language: null,
  availableOn: null,
  sort: 'distance',
};

/** Guest counts offered for venues. */
export const GUEST_STEPS = [100, 250, 400, 600, 800] as const;

/** The steps, plus a count that came from the plan ("250 to 500" seats 500), so it shows as picked. */
export function guestSteps(picked: number | null): number[] {
  const steps: number[] = [...GUEST_STEPS];
  return picked === null || steps.includes(picked)
    ? steps
    : [...steps, picked].sort((a, b) => a - b);
}

/**
 * Price ceilings that make sense for the kind of vendor: venues and food are
 * priced per plate or person, most others per event.
 */
export function priceSteps(groupSlug: string | null): number[] {
  return groupSlug === 'venues' || groupSlug === 'food'
    ? [25, 40, 60, 80]
    : [500, 1000, 2500, 5000];
}

/** How many filters are on (the order isn't a filter). */
export function activeFilterCount(filters: SearchFilters): number {
  return [filters.minGuests, filters.maxPrice, filters.language, filters.availableOn].filter(
    (v) => v !== null,
  ).length;
}

let current: SearchFilters = NO_FILTERS;
const listeners = new Set<() => void>();

export function setSearchFilters(change: Partial<SearchFilters>) {
  current = { ...current, ...change };
  listeners.forEach((listener) => listener());
}

export function clearSearchFilters() {
  current = NO_FILTERS;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The current filters, re-rendering when they change. */
export function useSearchFilters(): SearchFilters {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => NO_FILTERS,
  );
}
