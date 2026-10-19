/**
 * The wedding as someone tells it before they have an account: the date (or
 * that there isn't one yet) and about how many guests, from the quick
 * questions behind Home's wedding card (src/app/when.tsx). Where it is goes
 * straight to the search location. Kept only on this phone; once they sign
 * in and make a plan, the first questions start from it and it's cleared.
 */
import { useSyncExternalStore } from 'react';

import type { GuestBand } from '@/data/inquiries';
import { GUEST_BANDS } from '@/features/inquiry/inquiry-helpers';
import { readSetting, StorageKeys, writeSetting } from '@/lib/storage';

export type WeddingDraft = {
  /** yyyy-mm-dd, or null when they haven't said. */
  date: string | null;
  /** They said there's no date yet. */
  noDateYet: boolean;
  guestBand: GuestBand | null;
};

export const EMPTY_DRAFT: WeddingDraft = { date: null, noDateYet: false, guestBand: null };

/** Reads a stored draft, keeping only what's well formed. */
export function parseDraft(raw: string | null): WeddingDraft {
  if (!raw) return EMPTY_DRAFT;
  try {
    const value = JSON.parse(raw) as Partial<Record<keyof WeddingDraft, unknown>>;
    const date =
      typeof value.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.date) ? value.date : null;
    const band = GUEST_BANDS.find((b) => b === value.guestBand) ?? null;
    return { date, noDateYet: !date && value.noDateYet === true, guestBand: band };
  } catch {
    return EMPTY_DRAFT;
  }
}

/** Whether they've told us anything yet. */
export function hasDraft(draft: WeddingDraft): boolean {
  return draft.date !== null || draft.noDateYet || draft.guestBand !== null;
}

let draft: WeddingDraft | null = null;
const listeners = new Set<() => void>();

function current(): WeddingDraft {
  draft ??= parseDraft(readSetting(StorageKeys.weddingDraft));
  return draft;
}

/** The draft right now, outside React (the first questions start from it). */
export function getWeddingDraft(): WeddingDraft {
  return current();
}

export function setWeddingDraft(change: Partial<WeddingDraft>) {
  draft = { ...current(), ...change };
  void writeSetting(StorageKeys.weddingDraft, JSON.stringify(draft));
  listeners.forEach((listener) => listener());
}

/** Forget it, once the account has the wedding. */
export function clearWeddingDraft() {
  if (!hasDraft(current())) return;
  setWeddingDraft(EMPTY_DRAFT);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useWeddingDraft(): WeddingDraft {
  return useSyncExternalStore(subscribe, current, current);
}
