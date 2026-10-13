import { useSyncExternalStore } from 'react';

import { type Business, useMyBusinesses } from '@/data/business';

// Which business the "My business" screens are about, for someone who runs
// several. Kept for the session; the first (A to Z) until they pick.
let chosenId: string | null = null;
const listeners = new Set<() => void>();

export function chooseBusiness(id: string) {
  chosenId = id;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The business the screens show, and every one the person runs. */
export function useCurrentBusiness() {
  const { businesses, isPending } = useMyBusinesses();
  const chosen = useSyncExternalStore(subscribe, () => chosenId);
  const business: Business | null =
    businesses.find((b) => b.id === chosen) ?? businesses[0] ?? null;
  return {
    business,
    businesses,
    vendorId: business?.id ?? '',
    isVendor: businesses.length > 0,
    isPending,
  };
}
