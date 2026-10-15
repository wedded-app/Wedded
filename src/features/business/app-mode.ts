/**
 * Business mode (#252): people who run a wedding business get their own tabs
 * (app/(business): Today, Wanted, Reels, Leads, Business), everyone else the
 * planning tabs. A business with no wedding of its own opens in business mode;
 * someone who also plans one switches from Profile or the Business tab, and
 * this phone remembers the last choice.
 */
import { router, usePathname } from 'expo-router';

import { useIsVendor } from '@/data/chat';
import { useMyWeddings } from '@/data/wedding';
import { useSession } from '@/features/auth/session';
import { readSetting, StorageKeys, writeSetting } from '@/lib/storage';

export type AppMode = 'business' | 'planning';

let chosen: AppMode | null | undefined;

function chosenMode(): AppMode | null {
  if (chosen === undefined) {
    const value = readSetting(StorageKeys.appMode);
    chosen = value === 'business' || value === 'planning' ? value : null;
  }
  return chosen;
}

function remember(mode: AppMode) {
  chosen = mode;
  void writeSetting(StorageKeys.appMode, mode);
}

export function switchToBusiness() {
  remember('business');
  router.replace('/today');
}

export function switchToPlanning() {
  remember('planning');
  router.replace('/');
}

/** The side Home opens on: the one they last chose, or business for a business with no wedding. */
export function openingMode(
  chosen: AppMode | null,
  runsBusiness: boolean,
  hasWedding: boolean,
): AppMode {
  if (!runsBusiness) return 'planning';
  return chosen ?? (hasWedding ? 'planning' : 'business');
}

/**
 * Whether opening Home should go to business mode instead ('wait' while the
 * account loads). Only Home: a shared link to a page opens that page.
 */
export function useOpensInBusiness(): boolean | 'wait' {
  const atHome = usePathname() === '/';
  const { status } = useSession();
  const vendor = useIsVendor();
  const weddings = useMyWeddings();
  if (!atHome) return false;
  // Someone who left in business mode never sees the family Home flash by
  if (status === 'loading') return chosenMode() === 'business' ? 'wait' : false;
  if (status !== 'signedIn') return false;
  if (vendor.isPending) return 'wait';
  if (!vendor.isVendor) return false;
  if (chosenMode() === null && weddings.isPending) return 'wait';
  return openingMode(chosenMode(), true, (weddings.data?.length ?? 0) > 0) === 'business';
}
