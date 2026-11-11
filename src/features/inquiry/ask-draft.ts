/**
 * Ask for a quote (src/app/ask/): five short pages, one question each, like
 * List your business and the family's first questions. What they answer is
 * kept here in memory while they go back and forth, then sent from the last
 * page. Opening Ask again (the first page mounting) starts a fresh draft.
 * The pure parts (answers to `details`, Ask again's answers back) are tested.
 */
import { useSyncExternalStore } from 'react';

import { createListeners } from '@/lib/listeners';

import type { DayPart, QuestionSet } from './details';

export type TimeOfDay = 'day' | 'evening' | 'both';
/** Who does the food at a hall: their kitchen, a caterer they bring, or not decided. */
export type WhoCooks = 'kitchen' | 'own' | 'not_sure';
export type Menu = 'veg' | 'nonveg';
export type Meat = 'jhatka' | 'halal' | 'either';
export type Alcohol = 'yes' | 'no' | 'not_sure';

export const LIVE_COUNTERS = ['tandoor', 'chaat', 'jalebi', 'dosa', 'kulfi', 'chai'] as const;
export const MAX_VISIT_DAYS = 3;

export type AskDraft = {
  vendorId: string;
  /** Asking to visit a hall ("Visit the hall") instead of for a price. */
  tour: boolean;
  /** The events they're asking about (events.slug); none means not sure. */
  eventSlugs: string[];
  /** The day they picked; null follows the day in their plan. */
  pickedDate: string | null;
  dateUnsure: boolean;
  /** About how many guests; null follows their plan. */
  guestCount: number | null;
  guestsUnsure: boolean;
  timeOfDay: TimeOfDay | null;
  whoCooks: WhoCooks | null;
  menu: Menu | null;
  meat: Meat | null;
  liveCounters: string[];
  tasting: boolean | null;
  alcohol: Alcohol | null;
  /** The baraat arrives at the hall (with a horse and dhol). */
  baraat: boolean | null;
  /** Up to three days they could visit, yyyy-mm-dd, and the part of the day. */
  visitDays: string[];
  visitPart: DayPart;
  /** Where the event is, for vendors who come to it; null fills it in from their town. */
  place: string | null;
  /** Their own words, once they change the message Wed wrote. */
  ownMessage: string | null;
  /** Changed on the last page; null uses their profile. */
  name: string | null;
  phone: string | null;
  /** They answered something, so closing asks first. */
  touched: boolean;
};

export const EMPTY_DRAFT: AskDraft = {
  vendorId: '',
  tour: false,
  eventSlugs: [],
  pickedDate: null,
  dateUnsure: false,
  guestCount: null,
  guestsUnsure: false,
  timeOfDay: null,
  whoCooks: null,
  menu: null,
  meat: null,
  liveCounters: [],
  tasting: null,
  alcohol: null,
  baraat: null,
  visitDays: [],
  visitPart: 'afternoon',
  place: null,
  ownMessage: null,
  name: null,
  phone: null,
  touched: false,
};

let draft: AskDraft = EMPTY_DRAFT;
const listeners = createListeners();

/** The draft, re-rendering whenever it changes. */
export function useAskDraft(): AskDraft {
  return useSyncExternalStore(
    listeners.subscribe,
    () => draft,
    () => draft,
  );
}

export function getAskDraft(): AskDraft {
  return draft;
}

/** An answer: marks the draft touched, so closing asks before throwing it away. */
export function setAsk(patch: Partial<AskDraft>) {
  draft = { ...draft, ...patch, touched: true };
  listeners.notify();
}

/** A fresh draft for this vendor, with what the link brought (Ask again, the date ticket). */
export function startAsk(start: Partial<AskDraft> & { vendorId: string }) {
  draft = { ...EMPTY_DRAFT, ...start, touched: false };
  listeners.notify();
}

/** The events the page picks for them (the one this vendor is for), not counted as an answer. */
export function preselectEvents(eventSlugs: string[]) {
  draft = { ...draft, eventSlugs };
  listeners.notify();
}

/** The one food answer the booking sheet prints: veg, veg and non-veg, jhatka or halal. */
export function foodOf(
  menu: Menu | null,
  meat: Meat | null,
): 'veg' | 'veg_nonveg' | 'jhatka' | 'halal' | null {
  if (menu === 'veg') return 'veg';
  if (menu !== 'nonveg') return null;
  if (meat === 'jhatka' || meat === 'halal') return meat;
  return 'veg_nonveg';
}

const CATERING: Record<WhoCooks, string> = {
  kitchen: 'in_house',
  own: 'own',
  not_sure: 'not_sure',
};

/**
 * Only what they answered, in the shape the booking sheet and the vendor's
 * email print (`details`): a hall's questions, a caterer's menu, or just the
 * time of day for everyone else. The food a hall's kitchen would cook is sent
 * only when they picked the kitchen.
 */
export function askDetails(d: AskDraft, set: QuestionSet): Record<string, unknown> {
  const details: Record<string, unknown> = {};
  if (d.timeOfDay) details.timeOfDay = d.timeOfDay;
  const menu = () => {
    const food = foodOf(d.menu, d.meat);
    if (food) details.food = food;
    if (d.liveCounters.length > 0) details.liveStations = d.liveCounters;
  };
  if (set === 'venue') {
    if (d.tour) {
      details.tour = true;
      if (d.visitDays.length > 0) {
        details.tourSlots = d.visitDays.map((date) => ({ date, part: d.visitPart }));
      }
      return details;
    }
    if (d.whoCooks) details.catering = CATERING[d.whoCooks];
    if (d.whoCooks === 'kitchen') menu();
    if (d.alcohol) details.alcohol = d.alcohol;
    if (d.baraat !== null) details.ghoriDhol = d.baraat;
  }
  if (set === 'caterer') {
    menu();
    if (d.tasting !== null) details.tasting = d.tasting;
  }
  return details;
}

const pick = <T>(value: unknown, allowed: readonly T[]): T | null =>
  allowed.includes(value as T) ? (value as T) : null;

/** A real yyyy-mm-dd day, today or later: visit days that have passed can't be asked for. */
function upcomingDay(value: unknown, today: string): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const real =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return real && value >= today;
}

/**
 * A sent inquiry's answers back into a draft, so Ask again starts from what
 * they asked last time (also the older form's answers: "Lunch and evening on
 * the same day" becomes Both). They come in through a link, so anything
 * unexpected is left out, and visit days only when they're still ahead.
 */
export function answersFromDetails(details: unknown, today: string): Partial<AskDraft> {
  const d = (details && typeof details === 'object' ? details : {}) as Record<string, unknown>;
  const answers: Partial<AskDraft> = {};
  const timeOfDay = pick(d.timeOfDay, ['day', 'evening', 'both'] as const);
  if (timeOfDay) answers.timeOfDay = timeOfDay;
  else if (d.sameDay === true) answers.timeOfDay = 'both';
  const catering = pick(d.catering, ['in_house', 'own', 'not_sure'] as const);
  if (catering) answers.whoCooks = catering === 'in_house' ? 'kitchen' : catering;
  const food = pick(d.food, ['veg', 'veg_nonveg', 'jhatka', 'halal'] as const);
  if (food) {
    answers.menu = food === 'veg' ? 'veg' : 'nonveg';
    if (food === 'jhatka' || food === 'halal') answers.meat = food;
  }
  if (Array.isArray(d.liveStations)) {
    answers.liveCounters = d.liveStations.filter((s): s is string =>
      (LIVE_COUNTERS as readonly string[]).includes(s as string),
    );
  }
  if (typeof d.tasting === 'boolean') answers.tasting = d.tasting;
  const alcohol = pick(d.alcohol, ['yes', 'no', 'not_sure'] as const);
  if (alcohol) answers.alcohol = alcohol;
  if (typeof d.ghoriDhol === 'boolean') answers.baraat = d.ghoriDhol;
  if (Array.isArray(d.tourSlots)) {
    const slots = (d.tourSlots as Record<string, unknown>[]).filter((slot) =>
      upcomingDay(slot?.date, today),
    );
    if (slots.length > 0) {
      answers.visitDays = slots.slice(0, MAX_VISIT_DAYS).map((slot) => slot.date as string);
      const part = pick(slots[0].part, ['morning', 'afternoon', 'evening'] as const);
      if (part) answers.visitPart = part;
    }
  }
  return answers;
}

/** Tapping a visit day: on or off, never more than three. */
export function toggleVisitDay(days: string[], day: string): string[] {
  if (days.includes(day)) return days.filter((d) => d !== day);
  if (days.length >= MAX_VISIT_DAYS) return days;
  return [...days, day].sort();
}
