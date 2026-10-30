import { useSyncExternalStore } from 'react';

import { type Business, useMyBusinesses } from '@/data/business';
import { createListeners } from '@/lib/listeners';

// Which business the "My business" screens are about, for someone who runs
// several. Kept for the session; the first (A to Z) until they pick.
let chosenId: string | null = null;
const { subscribe, notify } = createListeners();

export function chooseBusiness(id: string) {
  chosenId = id;
  notify();
}

/** The business the screens show, and every one the person runs. */
export function useCurrentBusiness() {
  const { businesses, isPending } = useMyBusinesses();
  const chosen = useSyncExternalStore(
    subscribe,
    () => chosenId,
    () => chosenId,
  );
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
