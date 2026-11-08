import { useMemo } from 'react';

import { useAllEventNeeds, useTraditions } from '@/data/reference';
import { useWeddingPlan } from '@/data/wedding';

import { needsForPlaces } from './place';
import { activeTraditions, chosenEvents, mergedEvents, nextToBook, planProgress } from './plan';

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

  const view = useMemo(() => {
    const all = traditions.data ?? [];
    const needsByEvent = needsForPlaces(needs.data ?? {}, places ?? {});
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
  }, [plan, traditions.data, needs.data, places]);

  return {
    ...wedding,
    ...view,
    isPending: traditions.isPending || needs.isPending,
    isError: traditions.isError || needs.isError,
    refetch: () => Promise.all([traditions.refetch(), needs.refetch()]),
  };
}
