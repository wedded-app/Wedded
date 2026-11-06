import { useState } from 'react';

import type { TraditionEvent } from '@/data/reference';
import { localized } from '@/i18n/localized';

import { dayGroups, hasOwnDay, mainDay, shownDates, type DaysState } from './days';
import type { usePlanView } from './use-plan-view';

type PlanView = ReturnType<typeof usePlanView>;

/**
 * The wedding's days on the Wedding tab: the chosen events that have a day
 * of their own, each one's day (the wedding date stands in on the first
 * wedding-day event until one has its own), how they group, and `change`,
 * which saves the days that moved and keeps the wedding date on the main
 * day. Events joined before either has a day stay joined only while the
 * screen is open; once they have a date, the shared date keeps them
 * together.
 */
export function usePlanDays(view: PlanView) {
  const { plan, chosen } = view;
  const events: TraditionEvent[] = chosen.filter(hasOwnDay);
  const order = events.map((event) => event.slug);
  const [joined, setJoined] = useState<string[]>([]);
  const state: DaysState = {
    dates: shownDates(events, plan.eventDates, plan.weddingDate),
    joined,
  };

  const change = (next: DaysState) => {
    for (const slug of order) {
      const was = plan.eventDates?.[slug] ?? null;
      const now = next.dates[slug] ?? null;
      if (was !== now) view.setEventDate(slug, now);
    }
    // The countdown counts to the main day; with no wedding-day event to
    // follow, the wedding date is left as the family set it
    if (events.some((event) => event.phase === 'wedding_day')) {
      const main = mainDay(events, next.dates);
      if (main !== plan.weddingDate) view.setWeddingDate(main);
    }
    setJoined(next.joined);
  };

  return {
    events,
    order,
    state,
    groups: dayGroups(order, state),
    change,
    /** For DayList: each event's name and when it usually happens. */
    listed: events.map((event) => ({
      slug: event.slug,
      name: localized(event.name),
      timing: event.timing ? localized(event.timing) : null,
    })),
  };
}
