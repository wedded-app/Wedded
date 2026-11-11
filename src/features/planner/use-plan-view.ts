import { useMemo } from 'react';

import {
  useAllEventNeeds,
  useTraditions,
  type EventNeedsSection,
  type Tradition,
} from '@/data/reference';
import { useWeddingPlan } from '@/data/wedding';
import { draftPlan, useWeddingDraft } from '@/features/home/wedding-draft';

import { needsForPlaces } from './place';
import {
  activeTraditions,
  chosenEvents,
  mergedEvents,
  nextToBook,
  planProgress,
  type WeddingPlan,
} from './plan';

/** The traditions, events, needs and progress a plan shows, worked out once. */
function viewOf(
  plan: WeddingPlan,
  all: Tradition[],
  needs: Record<string, EventNeedsSection[]>,
  places: Record<string, string>,
) {
  const needsByEvent = needsForPlaces(needs, places);
  const active = activeTraditions(plan, all);
  const events = mergedEvents(active);
  const chosen = chosenEvents(plan, events);
  return {
    traditions: all,
    active,
    events,
    chosen,
    needsByEvent,
    progress: planProgress(plan, chosen, needsByEvent),
    next: nextToBook(plan, chosen, needsByEvent, 3),
  };
}

/**
 * Everything My Wedding and the Home countdown show, worked out once: the
 * plan (the account's when it's saved there, else the phone's) with its
 * edit functions, the family's traditions and their events, the chosen
 * events in ceremony order with what each needs (no hall for one at home),
 * overall progress, and the next few essentials to book.
 */
export function usePlanView() {
  const wedding = useWeddingPlan();
  const traditions = useTraditions();
  const needs = useAllEventNeeds();
  const { plan } = wedding;
  const places = wedding.wedding?.eventPlaces;

  const view = useMemo(
    () => viewOf(plan, traditions.data ?? [], needs.data ?? {}, places ?? {}),
    [plan, traditions.data, needs.data, places],
  );

  return {
    ...wedding,
    ...view,
    isPending: traditions.isPending || needs.isPending,
    isError: traditions.isError || needs.isError,
    refetch: () => Promise.all([traditions.refetch(), needs.refetch()]),
  };
}

/**
 * The same, for the plan someone made in the first questions before
 * signing in, kept on this phone until they save it (wedding-draft): Home
 * and "Your plan is ready" show it like a saved one, with nothing booked.
 */
export function useDraftPlanView() {
  const draft = useWeddingDraft();
  const traditions = useTraditions();
  const needs = useAllEventNeeds();

  return useMemo(() => {
    const plan = draftPlan(draft);
    return { plan, ...viewOf(plan, traditions.data ?? [], needs.data ?? {}, {}) };
  }, [draft, traditions.data, needs.data]);
}
