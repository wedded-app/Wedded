/**
 * The wedding's days: which events share a day, and the day each one is on.
 * Used by "When is each one?" in the first questions and by Your days on the
 * Wedding tab. Pure, so tests can load it.
 *
 * An event's day is its own date. Two events are on the same day when they
 * have the same date, or when the family joined them before picking one
 * (`joined`, the events joined to the one before them, kept only until
 * there's a date to store). The list keeps ceremony order, so a day is a
 * run of events next to each other.
 */

/** One event as the day list needs it: its slug and phase (before, wedding_day, after, whole_wedding). */
export type DayEvent = { slug: string; phase: string };

/** A run of events on one day, and that day (yyyy-mm-dd) once it's picked. */
export type DayGroup = { slugs: string[]; date: string | null };

export type DaysState = {
  /** Each event's day, yyyy-mm-dd. */
  dates: Record<string, string>;
  /** Events joined to the one before them while neither has a day. */
  joined: string[];
};

/** Whether an event is a ceremony with its own day (not the Whole wedding card). */
export function hasOwnDay(event: { phase: string }): boolean {
  return event.phase !== 'whole_wedding';
}

/**
 * The events in order as days: each event joins the day before it when it
 * was joined to it, or when they're on the same date.
 */
export function dayGroups(order: string[], state: DaysState): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const slug of order) {
    const date = state.dates[slug] ?? null;
    const last = groups[groups.length - 1];
    const sameDate = !!last && date !== null && last.date === date;
    if (last && (sameDate || state.joined.includes(slug))) {
      last.slugs.push(slug);
      last.date ??= date;
    } else {
      groups.push({ slugs: [slug], date });
    }
  }
  return groups;
}

/** The day `slug` is part of. */
export function groupOf(groups: DayGroup[], slug: string): DayGroup | undefined {
  return groups.find((group) => group.slugs.includes(slug));
}

/** Whether `slug` shares a day with the event before it. */
export function isJoined(groups: DayGroup[], slug: string): boolean {
  const group = groupOf(groups, slug);
  return !!group && group.slugs[0] !== slug;
}

function withDates(dates: Record<string, string>, slugs: string[], date: string | null) {
  const next = { ...dates };
  for (const slug of slugs) {
    if (date) next[slug] = date;
    else delete next[slug];
  }
  return next;
}

/** Every event on `slug`'s day moves to `date` (or loses its day for null). */
export function setDay(order: string[], state: DaysState, slug: string, date: string | null) {
  const group = groupOf(dayGroups(order, state), slug);
  const slugs = group?.slugs ?? [slug];
  const rest = slugs.slice(1);
  return {
    dates: withDates(state.dates, slugs, date),
    // With a date they share it, which keeps them together; without one
    // they stay joined until the next is picked
    joined: date
      ? state.joined.filter((s) => !slugs.includes(s))
      : [...state.joined.filter((s) => !rest.includes(s)), ...rest],
  };
}

/**
 * Puts `slug` (and anything joined after it) on the same day as the event
 * before it: that day's date when it has one, else `slug`'s own, else
 * they're joined until a day is picked.
 */
export function joinDay(order: string[], state: DaysState, slug: string): DaysState {
  const groups = dayGroups(order, state);
  const index = groups.findIndex((group) => group.slugs[0] === slug);
  if (index <= 0) return state;
  const before = groups[index - 1];
  const after = groups[index];
  const date = before.date ?? after.date;
  const slugs = [...before.slugs, ...after.slugs];
  if (date) {
    return {
      dates: withDates(state.dates, slugs, date),
      joined: state.joined.filter((s) => !slugs.includes(s)),
    };
  }
  return { dates: state.dates, joined: [...state.joined.filter((s) => s !== slug), slug] };
}

/**
 * Takes `slug` (and the events after it on that day) off the day before
 * it, onto a day of their own to pick.
 */
export function splitDay(order: string[], state: DaysState, slug: string): DaysState {
  const group = groupOf(dayGroups(order, state), slug);
  if (!group || group.slugs[0] === slug) return state;
  const moving = group.slugs.slice(group.slugs.indexOf(slug));
  return {
    dates: withDates(state.dates, moving, null),
    joined: state.joined.filter((s) => s !== slug),
  };
}

/**
 * The wedding's main day: the day of its first wedding-day event (the
 * Nikah, the Anand Karaj) that has one. Null until one does.
 */
export function mainDay(events: DayEvent[], dates: Record<string, string>): string | null {
  for (const event of events) {
    if (event.phase === 'wedding_day' && dates[event.slug]) return dates[event.slug];
  }
  return null;
}

/**
 * Each event's day as it's shown: its own date, and while no wedding-day
 * event has one, the wedding date (from Home's card, or a plan made before
 * events had days) on the first wedding-day event.
 */
export function shownDates(
  events: DayEvent[],
  dates: Record<string, string> | undefined,
  weddingDate: string | null,
): Record<string, string> {
  const shown: Record<string, string> = {};
  for (const event of events) {
    const own = dates?.[event.slug];
    if (own) shown[event.slug] = own;
  }
  if (weddingDate && !mainDay(events, shown)) {
    const first = events.find((event) => event.phase === 'wedding_day');
    if (first) shown[first.slug] = weddingDate;
  }
  return shown;
}
