/**
 * List your business (/for-vendors): the answers to its three questions,
 * kept between the question screens until the business's page is made
 * (start_my_business), the way the first questions keep theirs.
 */
import { useSyncExternalStore } from 'react';

import { matchCities, type City } from '@/data/places';
import type { Category, CategoryGroup } from '@/data/reference';
import { matchCategories } from '@/features/search/match-categories';
import { createListeners } from '@/lib/listeners';

export type JoinDraft = {
  /** The business's name, as families will see it. */
  name: string;
  /** What they do (categories.slug), picked from the list. */
  categorySlug: string | null;
  /** What they typed to find it. */
  kindQuery: string;
  /** The town as they typed it. */
  town: string;
  /** The town they picked (cities.slug), when more than one matched. */
  citySlug: string | null;
};

const EMPTY: JoinDraft = { name: '', categorySlug: null, kindQuery: '', town: '', citySlug: null };

let draft: JoinDraft = EMPTY;
const { subscribe, notify } = createListeners();

export function setJoinDraft(change: Partial<JoinDraft>) {
  draft = { ...draft, ...change };
  notify();
}

export function resetJoinDraft() {
  setJoinDraft(EMPTY);
}

export function getJoinDraft(): JoinDraft {
  return draft;
}

/** The answers so far, re-rendering when they change. */
export function useJoinDraft(): JoinDraft {
  return useSyncExternalStore(subscribe, getJoinDraft, () => EMPTY);
}

/** The questions, in order; each is a screen at /for-vendors/{step}. */
export const JOIN_STEPS = ['name', 'kind', 'town'] as const;
export type JoinStep = (typeof JOIN_STEPS)[number];

/**
 * How full the bar is as a question opens (`from`) and once it shows (`to`).
 * Making the page is the last share, so the bar is never full on a question.
 */
export function joinProgress(step: JoinStep): { from: number; to: number } {
  const index = JOIN_STEPS.indexOf(step);
  const shares = JOIN_STEPS.length + 1;
  return { from: index / shares, to: (index + 1) / shares };
}

/**
 * The kinds of business to pick from: every kind in the founders' order
 * (group by group) before they type, then the ones matching what they typed.
 */
export function kindOptions(
  groups: CategoryGroup[],
  categories: Category[],
  query: string,
): Category[] {
  if (query.trim()) return matchCategories(categories, query);
  const bySlug = new Map(categories.map((category) => [category.slug, category]));
  const ordered = groups.flatMap((group) =>
    group.categories.flatMap((item) => bySlug.get(item.slug) ?? []),
  );
  // Kinds in no group still belong on the list, last
  const listed = new Set(ordered.map((category) => category.slug));
  return [...ordered, ...categories.filter((category) => !listed.has(category.slug))];
}

/**
 * The towns matching what they typed, and the one their page will use: the
 * one they tapped, else the only match, else a match spelled exactly so.
 */
export function townChoice(
  cities: City[],
  typed: string,
  chosenSlug: string | null,
  limit = 5,
): { matches: City[]; picked: City | null } {
  const matches = matchCities(cities, typed, limit);
  const chosen = matches.find((city) => city.slug === chosenSlug);
  if (chosen) return { matches, picked: chosen };
  if (matches.length === 1) return { matches, picked: matches[0] };
  const exact = matches.find((city) => city.name.toLowerCase() === typed.trim().toLowerCase());
  return { matches, picked: exact ?? null };
}
