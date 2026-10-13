/**
 * What a family answers in the first questions (src/app/onboarding), kept in
 * memory until they finish, when useFinishOnboarding() turns it into their
 * plan.
 */
import { useSyncExternalStore } from 'react';

import type { GuestBand } from '@/data/inquiries';

/** Who the wedding is for, as weddings.planning_for stores it. */
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
  weddingDate: string | null;
  /** They said they haven't picked a date yet. */
  noDateYet: boolean;
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
  extraEvents: [],
  guestBand: null,
  citySlug: null,
};

let answers: Answers = EMPTY;
const listeners = new Set<() => void>();

export function setAnswers(change: Partial<Answers>) {
  answers = { ...answers, ...change };
  listeners.forEach((listener) => listener());
}

export function resetAnswers() {
  setAnswers(EMPTY);
}

export function getAnswers(): Answers {
  return answers;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The answers so far, re-rendering when they change. */
export function useAnswers(): Answers {
  return useSyncExternalStore(subscribe, getAnswers, () => EMPTY);
}

/** Adds or removes one item of a multi-choice answer. */
export function toggleIn(list: string[], item: string): string[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}
