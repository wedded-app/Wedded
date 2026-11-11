/**
 * The wedding as someone tells it before they have an account: the plan
 * the first questions made (their traditions, events and each one's day),
 * the main day for the countdown (or that there isn't one yet) and about
 * how many guests. Where it is goes straight to the search location. Kept
 * only on this phone; once they sign in, it's saved to their account
 * (useSaveDraftPlan) and cleared.
 */
import { useSyncExternalStore } from 'react';

import type { GuestBand } from '@/data/inquiries';
import { GUEST_BANDS } from '@/features/inquiry/inquiry-helpers';
import type { WeddingPlan } from '@/features/planner/plan-helpers';
import { readSetting, StorageKeys, writeSetting } from '@/lib/storage';
import { createListeners } from '@/lib/listeners';

export type WeddingDraft = {
  /** The main day, yyyy-mm-dd, or null when they haven't said. */
  date: string | null;
  /** They said there's no date yet. */
  noDateYet: boolean;
  guestBand: GuestBand | null;
  /** The traditions their answers led to (cultures.slug). */
  traditions: string[];
  /** The events they're having (events.slug); empty until they finish the questions. */
  events: string[];
  /** Each event's own day, yyyy-mm-dd. */
  eventDates: Record<string, string>;
  /** Who the wedding is for (profiles.planning_for), when they said. */
  planningFor: string | null;
};

export const EMPTY_DRAFT: WeddingDraft = {
  date: null,
  noDateYet: false,
  guestBand: null,
  traditions: [],
  events: [],
  eventDates: {},
  planningFor: null,
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

function days(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string' && DAY.test(entry[1]),
    ),
  );
}

/** Reads a stored draft, keeping only what's well formed. */
export function parseDraft(raw: string | null): WeddingDraft {
  if (!raw) return EMPTY_DRAFT;
  try {
    const value = JSON.parse(raw) as Partial<Record<keyof WeddingDraft, unknown>>;
    const date = typeof value.date === 'string' && DAY.test(value.date) ? value.date : null;
    const band = GUEST_BANDS.find((b) => b === value.guestBand) ?? null;
    return {
      date,
      noDateYet: !date && value.noDateYet === true,
      guestBand: band,
      traditions: strings(value.traditions),
      events: strings(value.events),
      eventDates: days(value.eventDates),
      planningFor: typeof value.planningFor === 'string' ? value.planningFor : null,
    };
  } catch {
    return EMPTY_DRAFT;
  }
}

/** Whether they've told us anything yet. */
export function hasDraft(draft: WeddingDraft): boolean {
  return (
    draft.date !== null || draft.noDateYet || draft.guestBand !== null || draft.events.length > 0
  );
}

/** Whether they finished the first questions: a plan of events, waiting to be saved. */
export function hasDraftPlan(draft: WeddingDraft): boolean {
  return draft.events.length > 0;
}

/** The draft as a plan, the way an account's plan is shown and saved. */
export function draftPlan(draft: WeddingDraft): WeddingPlan & { planningFor: string | null } {
  const band = draft.guestBand;
  return {
    weddingDate: draft.date,
    traditions: draft.traditions,
    events: draft.events,
    booked: {},
    guests: band ? Object.fromEntries(draft.events.map((event) => [event, band])) : {},
    eventDates: draft.eventDates,
    planningFor: draft.planningFor,
  };
}

let draft: WeddingDraft | null = null;
const { subscribe, notify } = createListeners();

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
  notify();
}

/** Forget it, once the account has the wedding. */
export function clearWeddingDraft() {
  if (!hasDraft(current())) return;
  setWeddingDraft(EMPTY_DRAFT);
}

export function useWeddingDraft(): WeddingDraft {
  return useSyncExternalStore(subscribe, current, current);
}
