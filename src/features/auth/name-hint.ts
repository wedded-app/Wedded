import { useSyncExternalStore } from 'react';
import { createListeners } from '@/lib/listeners';

/**
 * The name Apple shared while signing in. Apple sends it only the very first
 * time someone signs in to the app, and it isn't in the account, so it's kept
 * here (in memory, never saved) to fill in About you. It belongs to one Apple
 * ID (`appleUser`, the same as the `sub` of Apple's token and the account's
 * Apple identity id), so it's never offered to anyone else.
 */
export type NameHint = { appleUser: string; name: string };

let current: NameHint | null = null;
const { subscribe, notify } = createListeners();

export function setNameHint(hint: NameHint | null) {
  current = hint;
  notify();
}

const read = () => current;

export function useNameHint(): NameHint | null {
  return useSyncExternalStore(subscribe, read, read);
}
