/**
 * The order of Home's events timeline: the events that are days, by their
 * dates once every one has its own (until then, the ceremony order the
 * traditions give). The whole wedding isn't a day, so it isn't on it
 * (Fezy, 2026-11-08); its vendors are on the Wedding tab.
 */
export function timelineOrder<T extends { slug: string; phase: string }>(
  events: T[],
  eventDates: Record<string, string> | undefined,
): T[] {
  const days = events.filter((event) => event.phase !== 'whole_wedding');
  const allDated = days.every((event) => !!eventDates?.[event.slug]);
  const dated = allDated
    ? [...days].sort((a, b) =>
        (eventDates?.[a.slug] ?? '').localeCompare(eventDates?.[b.slug] ?? ''),
      )
    : days;
  return dated;
}
