/**
 * Plain logic for wedding websites: the date line and city under the names,
 * the countdown, which parts have something to show, and what's still
 * missing. No React, so it's tested on its own (site-helpers.test.ts).
 */
import type { SiteEvent, SitePage, SiteSection } from '@/data/website';

function parseDay(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

const monthName = (date: Date) => new Intl.DateTimeFormat('en-US', { month: 'long' }).format(date);

/** "Saturday, June 12, 2027". */
export function longDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(parseDay(value));
}

/** "Fri, Jun 11": an event's day, under a header that already has the year. */
export function shortDay(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(parseDay(value));
}

/** The events' days in order, without repeats. */
function eventDays(events: SiteEvent[]): string[] {
  return [...new Set(events.map((e) => e.date).filter((d): d is string => !!d))].sort();
}

/**
 * The line under the couple's names: "June 11–12, 2027" across several days,
 * "June 30 – July 2, 2027" across months, one long date for a single day, or
 * the wedding's date when no event has one yet. Null with no date at all.
 */
export function dateRangeLine(events: SiteEvent[], weddingDate: string | null): string | null {
  const days = eventDays(events);
  if (days.length === 0) return weddingDate ? longDate(weddingDate) : null;
  const first = parseDay(days[0]);
  const last = parseDay(days[days.length - 1]);
  if (days.length === 1) return longDate(days[0]);
  const y1 = first.getFullYear();
  const y2 = last.getFullYear();
  if (y1 !== y2) {
    return `${monthName(first)} ${first.getDate()}, ${y1} – ${monthName(last)} ${last.getDate()}, ${y2}`;
  }
  if (first.getMonth() === last.getMonth()) {
    return `${monthName(first)} ${first.getDate()}–${last.getDate()}, ${y1}`;
  }
  return `${monthName(first)} ${first.getDate()} – ${monthName(last)} ${last.getDate()}, ${y1}`;
}

/** The town most of the events are in, for the cover; null when none has one. */
export function cityLine(events: SiteEvent[]): string | null {
  const counts = new Map<string, number>();
  for (const e of events) if (e.city) counts.set(e.city, (counts.get(e.city) ?? 0) + 1);
  let best: string | null = null;
  for (const [city, count] of counts) if (!best || count > (counts.get(best) ?? 0)) best = city;
  return best;
}

/** The first day of the wedding: the earliest event, else the wedding's date. */
export function firstDay(events: SiteEvent[], weddingDate: string | null): string | null {
  return eventDays(events)[0] ?? weddingDate;
}

/** Whole days from today until `date` (0 on the day, negative after it). */
export function daysUntil(date: string, today: Date = new Date()): number {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((parseDay(date).getTime() - start.getTime()) / 86400000);
}

/** "Asha & Ravi" as its two names, so the "&" can be drawn in the accent; null for one name. */
export function splitNames(title: string): [string, string] | null {
  const parts = title.split(/\s+(?:&|and)\s+/i);
  return parts.length === 2 && parts[0] && parts[1] ? [parts[0], parts[1]] : null;
}

/** Whether a part of the site has anything to show. */
export function hasContent(page: SitePage, section: SiteSection): boolean {
  switch (section) {
    case 'family':
      return page.familyLines.length > 0;
    case 'story':
      return !!page.story;
    case 'events':
      return page.events.length > 0;
    case 'rsvp':
      return page.events.length > 0 && (!!page.guest || !!page.rsvpLink);
    case 'guide':
      return page.tips.length > 0;
    case 'travel':
      return page.hotels.length > 0;
    case 'livestream':
      return !!page.livestreamUrl;
    case 'faq':
      return page.faq.length > 0;
  }
}

/** The parts guests see, in the family's order: switched on and not empty. */
export function visibleSections(page: SitePage): SiteSection[] {
  return page.sections.filter((s) => hasContent(page, s));
}

/** The builder's first steps and whether each is done. */
export function startSteps(page: SitePage) {
  return {
    design: page.design !== 'classic' || page.palette !== null,
    cover: !!page.coverPath,
    dress: page.events.length > 0 && page.events.every((e) => !!e.dressCode),
    published: !!page.publishedAt,
  };
}

export type MissingPart =
  | { kind: 'cover' }
  | { kind: 'welcome' }
  | { kind: 'rsvpBy' }
  | { kind: 'published' }
  | { kind: 'eventDate' | 'eventPlace' | 'eventDress'; eventSlug: string };

/** What a guest would miss, most important first (Wed's "Is anything missing?"). */
export function missingParts(page: SitePage): MissingPart[] {
  const out: MissingPart[] = [];
  for (const e of page.events) if (!e.date) out.push({ kind: 'eventDate', eventSlug: e.slug });
  for (const e of page.events) if (!e.place) out.push({ kind: 'eventPlace', eventSlug: e.slug });
  if (!page.coverPath) out.push({ kind: 'cover' });
  for (const e of page.events)
    if (!e.dressCode) out.push({ kind: 'eventDress', eventSlug: e.slug });
  if (!page.rsvpBy) out.push({ kind: 'rsvpBy' });
  if (!page.welcome) out.push({ kind: 'welcome' });
  if (!page.publishedAt) out.push({ kind: 'published' });
  return out;
}

/** "jaspreet-amrit" from what someone typed, like the database does it. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
