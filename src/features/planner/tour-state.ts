/**
 * Whether this phone has had the Wedding tab's first-visit tour: false the
 * first time, true once they've been through it or skipped it.
 */
import { useSyncExternalStore } from 'react';

import { createListeners } from '@/lib/listeners';
import { readSetting, StorageKeys, writeSetting } from '@/lib/storage';

let seen: boolean | null = null;
const { subscribe, notify } = createListeners();

function current(): boolean {
  seen ??= readSetting(StorageKeys.weddingTour) === 'done';
  return seen;
}

export function markTourSeen() {
  seen = true;
  void writeSetting(StorageKeys.weddingTour, 'done');
  notify();
}

/** Settings' Testing row: show it again next time the Wedding tab opens. */
export function resetTour() {
  seen = false;
  void writeSetting(StorageKeys.weddingTour, '');
  notify();
}

export function useTourSeen(): boolean {
  // Pre-rendered on the web there's no storage: count it as seen
  return useSyncExternalStore(subscribe, current, () => true);
}
