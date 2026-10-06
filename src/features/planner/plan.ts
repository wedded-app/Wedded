/**
 * My Wedding (vision S15b/S15c, the planning board): the wedding date, the
 * family's traditions, which events they're having, and which vendor types
 * are booked for each. A plan belongs to an account (src/data/wedding.ts,
 * docs/DECISIONS.md 2026-10-02); this store only keeps a copy of the
 * account's plan on the phone (syncedWeddingId set), so Home, Profile and
 * the search filters show it without waiting. Signing out clears it.
 */
import { useSyncExternalStore } from 'react';

import { readSetting, StorageKeys, writeSetting } from '@/lib/storage';

import type { WeddingPlan } from './plan-helpers';

export type { WeddingPlan };

export const EMPTY_PLAN: WeddingPlan = {
  weddingDate: null,
  traditions: [],
  events: [],
  booked: {},
};
const EMPTY = EMPTY_PLAN;

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

function load(): WeddingPlan {
  try {
    const raw = readSetting(StorageKeys.weddingPlan);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<WeddingPlan>;
    return {
      weddingDate: typeof parsed.weddingDate === 'string' ? parsed.weddingDate : null,
      traditions: strings(parsed.traditions),
      events: strings(parsed.events),
      booked: typeof parsed.booked === 'object' && parsed.booked ? parsed.booked : {},
      guests: typeof parsed.guests === 'object' && parsed.guests ? parsed.guests : {},
      syncedWeddingId: typeof parsed.syncedWeddingId === 'string' ? parsed.syncedWeddingId : null,
    };
  } catch {
    return EMPTY;
  }
}

let plan: WeddingPlan | null = null;
const listeners = new Set<() => void>();

function current(): WeddingPlan {
  plan ??= load();
  return plan;
}

function update(change: (plan: WeddingPlan) => WeddingPlan) {
  plan = change(current());
  void writeSetting(StorageKeys.weddingPlan, JSON.stringify(plan));
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Replace the whole plan: the copy of the account's plan. */
export function replacePlan(next: WeddingPlan) {
  update(() => next);
}

/** Forget the plan on this phone (signed out, or the account no longer has it). */
export function clearPlan() {
  update(() => EMPTY);
}

/** Whether there's anything to forget. */
export function isEmptyPlan(plan: WeddingPlan): boolean {
  return (
    !plan.syncedWeddingId &&
    !plan.weddingDate &&
    plan.traditions.length === 0 &&
    plan.events.length === 0 &&
    Object.keys(plan.booked).length === 0 &&
    Object.keys(plan.guests ?? {}).length === 0
  );
}

/** The plan, re-rendering whenever it changes. */
export function usePlan(): WeddingPlan {
  return useSyncExternalStore(subscribe, current, () => EMPTY);
}

export {
  activeTraditions,
  bookedCount,
  chosenEvents,
  daysUntil,
  essentialNeeds,
  mergedEvents,
  nextToBook,
  pickTradition,
  planProgress,
  signatureEvents,
  startingEvents,
} from './plan-helpers';
