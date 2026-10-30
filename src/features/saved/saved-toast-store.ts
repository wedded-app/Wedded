import type { Href } from 'expo-router';
import { useSyncExternalStore } from 'react';
import { createListeners } from '@/lib/listeners';

/**
 * The "Saved to Jaago · See list" toast's state, apart from its view
 * (saved-toast.tsx), so the save hooks in src/data can show it without
 * loading Reanimated (which Jest can't).
 */

export type SavedToast = {
  id: number;
  where: string | null;
  at: number;
  /** Where See list goes: Saved, unless the save went somewhere else (Wed's lists). */
  href: Href;
};

let toast: SavedToast | null = null;
let nextId = 1;
const { subscribe, notify } = createListeners();

const getToast = () => toast;

function setToast(next: SavedToast | null) {
  toast = next;
  notify();
}

/** The toast to show, or null. */
export function useSavedToast(): SavedToast | null {
  return useSyncExternalStore(subscribe, getToast, getToast);
}

/** Takes the toast down; only the one it was started for, so a newer save keeps its own time. */
export function clearSavedToast(id: number) {
  if (toast?.id === id) setToast(null);
}

/**
 * Shows "Saved to {where} · See list", or "Saved · See list" without one.
 * `where` is an event's slug (shown as the event's name in the family's
 * language) or the words to show as they are, e.g. "Jaago". A newer save
 * replaces the toast on screen. `href` is where See list goes (/saved).
 */
export function showSavedToast(where?: string | null, href: Href = '/saved') {
  setToast({ id: nextId++, where: where ?? null, at: Date.now(), href });
}
