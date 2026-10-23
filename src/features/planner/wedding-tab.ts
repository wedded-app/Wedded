/**
 * The plain logic behind the Wedding tab's top and its event tickets (the
 * final look, 2026-10-23): the wedding's days as one line, the days to go,
 * the faces of everyone planning, and each event's time, place and guests
 * in words. Pure functions: pass the app's translate function in.
 */
import type { EventGuestSummary } from '@/data/guests';
import type { WeddingMember } from '@/data/wedding';
import { formatTime, type Translate } from '@/features/vendors/profile-format';

import { daysUntil } from './plan-helpers';

/** Initials for a member's circle: "Asha Kaur" → "AK". */
export function initials(name: string | null): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase();
}

/**
 * Every day of the wedding, in order and once each: the wedding date and
 * the days of the chosen events that have their own.
 */
export function weddingDays(
  weddingDate: string | null,
  eventDates: Record<string, string> | undefined,
  events: string[],
): string[] {
  const days = new Set<string>();
  if (weddingDate) days.add(weddingDate);
  for (const slug of events) {
    const day = eventDates?.[slug];
    if (day) days.add(day);
  }
  return [...days].sort();
}

function dayParts(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  const name = new Date(Date.UTC(year, month - 1, day))
    .toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short' })
    .toUpperCase();
  return { year, month, day, name };
}

/**
 * The first to the last day in small capitals: "JUN 11, 2027",
 * "JUN 11–12, 2027", "MAY 30 – JUN 2, 2027" or "DEC 30, 2026 – JAN 2, 2027".
 * Null with no days.
 */
export function daysLine(days: string[]): string | null {
  if (days.length === 0) return null;
  const first = dayParts(days[0]);
  const last = dayParts(days[days.length - 1]);
  if (days[0] === days[days.length - 1]) return `${first.name} ${first.day}, ${first.year}`;
  if (first.year !== last.year) {
    return `${first.name} ${first.day}, ${first.year} – ${last.name} ${last.day}, ${last.year}`;
  }
  if (first.month !== last.month) {
    return `${first.name} ${first.day} – ${last.name} ${last.day}, ${first.year}`;
  }
  return `${first.name} ${first.day}–${last.day}, ${first.year}`;
}

export type Countdown = { kind: 'toGo'; days: number } | { kind: 'today' } | { kind: 'over' };

/**
 * How long until the wedding: to the wedding date, or to the first day
 * when there isn't one. From then until the last day it's "today", and
 * after that it's over. Null with no days.
 */
export function countdown(
  days: string[],
  weddingDate: string | null,
  today = new Date(),
): Countdown | null {
  if (days.length === 0) return null;
  const toGo = daysUntil(weddingDate ?? days[0], today);
  if (toGo > 0) return { kind: 'toGo', days: toGo };
  if (daysUntil(days[days.length - 1], today) >= 0) return { kind: 'today' };
  return { kind: 'over' };
}

/** The countdown in words: "232 days to go", "Today's the day" or the congratulations. */
export function countdownText(value: Countdown, t: Translate): string {
  if (value.kind === 'toGo') return t('planner.toGo', { count: value.days });
  if (value.kind === 'today') return t('planner.today');
  return t('planner.married');
}

/**
 * The calm line under the dates, instead of a booked count: "3 events ·
 * Mehndi comes first", or that everything's booked. Null with no events.
 */
export function eventsLine(
  eventsCount: number,
  firstEvent: string | null,
  allBooked: boolean,
  t: Translate,
): string | null {
  if (eventsCount === 0) return null;
  if (allBooked) return t('planner.eventsAllBooked', { count: eventsCount });
  if (firstEvent) return t('planner.eventsFirst', { count: eventsCount, first: firstEvent });
  return t('planner.eventsCount', { count: eventsCount });
}

export type Face = { key: string; letters: string; isMe: boolean };

/**
 * Everyone planning as overlapping circles, at most `room` of them: all of
 * them when they fit, else the first few and a "+3" circle for the rest.
 */
export function faceList(members: WeddingMember[], room = 3): { faces: Face[]; more: number } {
  const shown = members.length > room ? members.slice(0, room - 1) : members;
  return {
    faces: shown.map((member) => ({
      key: member.userId,
      letters: initials(member.name),
      isMe: member.isMe,
    })),
    more: members.length - shown.length,
  };
}

/** When and where an event is, as far as the family has said: "6:00 PM · Royal Orchard". */
export function whenLine(time: string | undefined, place: string | undefined): string | null {
  const parts = [time ? formatTime(time) : null, place?.trim() || null].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * How many are coming to an event from its RSVPs: "31 coming", or "48
 * invited" until someone says yes. Null before anyone's invited.
 */
export function comingLine(summary: EventGuestSummary | undefined, t: Translate): string | null {
  if (!summary || summary.peopleInvited === 0) return null;
  if (summary.coming > 0) return t('guests.comingCount', { count: summary.coming });
  return t('guests.invitedCount', { count: summary.peopleInvited });
}
