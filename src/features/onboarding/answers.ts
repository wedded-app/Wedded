/**
 * What a family answers in the first questions (src/app/onboarding), kept in
 * memory until they finish, when useFinishOnboarding() turns it into their
 * plan.
 */
import { useSyncExternalStore } from 'react';

import type { GuestBand } from '@/data/inquiries';
import { getWeddingDraft } from '@/features/home/wedding-draft';
import { createListeners } from '@/lib/listeners';

/** Who the wedding is for, as profiles.planning_for stores it. */
export type PlanningFor = 'self' | 'child' | 'sibling' | 'relative' | 'friend';

export type Answers = {
  planningFor: PlanningFor | null;
  /**
   * The faiths they picked (faiths.slug); two for a mixed family. Kept only
   * until the plan is made: the plan stores the traditions they lead to
   * (traditionsForFaiths), never the faith itself.
   */
  faiths: string[];
  /** Traditions picked on "Where are the families from?" (cultures.slug). */
  roots: string[];
  /** They said their kind of wedding isn't listed (they'll pick events themselves). */
  otherTradition: boolean;
  /**
   * The main day, kept in step with the wedding-day event's day once they
   * pick days (it starts as the date they gave on Home's card).
   */
  weddingDate: string | null;
  /** They said they haven't picked a date yet. */
  noDateYet: boolean;
  /**
   * The events they're having (events.slug), from "Which events are you
   * having?"; null until they change the ones it starts with.
   */
  events: string[] | null;
  /** Each event's day, yyyy-mm-dd, from "When is each one?". */
  eventDates: Record<string, string>;
  /** Events put on the same day as the one before them before either has a day. */
  joined: string[];
  /** Events named in a search ("mehndi and jaago"), added to the traditions' main events. */
  extraEvents: string[];
  /** A guest count from a search ("for 300 people"), for every event. */
  guestBand: GuestBand | null;
  /** A city named in a search (cities.slug), searched around once the plan is made. */
  citySlug: string | null;
};

const EMPTY: Answers = {
  planningFor: null,
  faiths: [],
  roots: [],
  otherTradition: false,
  weddingDate: null,
  noDateYet: false,
  events: null,
  eventDates: {},
  joined: [],
  extraEvents: [],
  guestBand: null,
  citySlug: null,
};

/** A fresh start, with the date and guests they gave before signing in (Home's wedding card). */
function startingAnswers(): Answers {
  const draft = getWeddingDraft();
  return {
    ...EMPTY,
    weddingDate: draft.date,
    noDateYet: draft.noDateYet,
    guestBand: draft.guestBand,
  };
}

let answers: Answers | null = null;
const { subscribe, notify } = createListeners();

export function setAnswers(change: Partial<Answers>) {
  answers = { ...getAnswers(), ...change };
  notify();
}

export function resetAnswers() {
  setAnswers(startingAnswers());
}

export function getAnswers(): Answers {
  answers ??= startingAnswers();
  return answers;
}

/** The answers so far, re-rendering when they change. */
export function useAnswers(): Answers {
  return useSyncExternalStore(subscribe, getAnswers, () => EMPTY);
}

/** Adds or removes one item of a multi-choice answer. */
export function toggleIn(list: string[], item: string): string[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}
