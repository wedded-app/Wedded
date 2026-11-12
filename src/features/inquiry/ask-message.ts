/**
 * The message Ask for a quote writes from the family's answers (the last
 * page, "Here's your message"): who they are planning for and when, what the
 * vendor needs to know in a sentence, and one plain question. Rewritten as
 * the answers change, until they edit it themselves. Pure, so tests can load it.
 */
import type { AskDraft } from './ask-draft';
import { fromDateString } from './inquiry-helpers';

type Translate = (key: string, options?: Record<string, string | number>) => string;

export type MessageFacts = {
  /** The events' names, in the order they picked them. */
  events: string[];
  /** Each event's own day from their plan; with two or more, the message names each. */
  eventDates: { event: string; date: string }[];
  /** The day (none when they're not sure). */
  date: string | null;
  /** About how many guests (none when they're not sure). */
  guests: number | null;
  /** Where the event is, for vendors who come to it; a hall's own place is left out. */
  place: string | null;
  /** Which questions this vendor gets: a hall's, a caterer's, or neither. */
  set: 'venue' | 'caterer' | null;
  /** The hall's drinks: full_bar, beer_wine, byob or dry (unknown when it didn't say). */
  alcoholPolicy?: string;
  /** Their arriving procession's name when it isn't a baraat (a Zaffa), which comes without the horse and dhol. */
  procession?: string;
  /** The live counters' names, as the page shows them. */
  counters: string[];
};

/** "Saturday, June 19, 2027". */
export function longDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(fromDateString(value));
}

/** "Sat, Nov 14", for visit days a few weeks away. */
export function shortDay(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(fromDateString(value));
}

/** 1st, 2nd, 3rd, 4th … 11th, 12th, 13th … 21st. */
export function ordinal(day: number): string {
  const tens = day % 100;
  if (tens >= 11 && tens <= 13) return `${day}th`;
  return `${day}${['th', 'st', 'nd', 'rd'][day % 10] ?? 'th'}`;
}

/** "a, b and c": the way the rest of the app lists things. */
export function listOf(items: string[], and: string): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} ${and} ${items[items.length - 1]}`;
}

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** What they'd like from the food, in words: "veg and non-veg, jhatka, with tandoor and jalebi counters". */
function menuWords(t: Translate, d: AskDraft, counters: string[]): string | null {
  const and = t('ask.write.and');
  const parts: string[] = [];
  if (d.menu === 'veg') parts.push(t('ask.write.menu.veg'));
  if (d.menu === 'nonveg') {
    parts.push(
      d.meat === 'jhatka' || d.meat === 'halal'
        ? t(`ask.write.menu.${d.meat}`)
        : t('ask.write.menu.nonveg'),
    );
  }
  if (counters.length > 0) {
    parts.push(t('ask.write.counters', { counters: listOf(counters, and) }));
  }
  return parts.length > 0 ? parts.join(', ') : null;
}

/**
 * "Hello! We're planning our Reception on Saturday, June 19, 2027, in
 * the evening, for about 300 guests. We're bringing our own caterer, we'd
 * like to use your bar, and the baraat will arrive at the hall with a horse
 * and dhol. Could you share your price, and is the 19th still open? Thank you."
 */
export function writtenMessage(t: Translate, d: AskDraft, facts: MessageFacts): string {
  const and = t('ask.write.and');
  const sentences: string[] = [t('ask.write.hello')];

  // We're planning our Reception (in Yuba City) on Saturday, June 19, 2027, in the evening, for about 300 guests.
  const what =
    facts.eventDates.length >= 2
      ? t('ask.write.our', {
          events: listOf(
            facts.eventDates.map(({ event, date }) =>
              t('ask.write.eventOn', { event, date: longDate(date) }),
            ),
            and,
          ),
        })
      : facts.events.length > 0
        ? t('ask.write.our', { events: listOf(facts.events, and) })
        : t('ask.write.aWedding');
  const place = facts.place?.trim() ? t('ask.write.inPlace', { place: facts.place.trim() }) : '';
  const when =
    facts.date && facts.eventDates.length < 2
      ? t('ask.write.onDate', { date: longDate(facts.date) })
      : '';
  const time = d.timeOfDay ? t(`ask.write.time.${d.timeOfDay}`) : '';
  const guests = facts.guests ? t('ask.write.guests', { number: facts.guests }) : '';
  sentences.push(t('ask.write.planning', { what, place, when, time, guests }));

  // What this vendor needs to know, as one sentence
  const wishes: string[] = [];
  if (facts.set === 'venue' && !d.tour) {
    if (d.whoCooks === 'own') wishes.push(t('ask.write.ownCaterer'));
    if (d.whoCooks === 'not_sure') wishes.push(t('ask.write.foodUndecided'));
    if (d.alcohol === 'yes') {
      wishes.push(
        facts.alcoholPolicy === 'byob'
          ? t('ask.write.ownDrinks')
          : facts.alcoholPolicy === 'full_bar' || facts.alcoholPolicy === 'beer_wine'
            ? t('ask.write.useBar')
            : t('ask.write.alcohol'),
      );
    }
    if (d.alcohol === 'no') wishes.push(t('ask.write.noAlcohol'));
    if (d.baraat === true) {
      wishes.push(
        facts.procession
          ? t('ask.write.procession', { event: facts.procession })
          : t('ask.write.baraat'),
      );
    }
  }
  if (wishes.length > 0) sentences.push(`${capitalise(listOf(wishes, and))}.`);

  // The food from their kitchen, or from the caterer being asked
  const food = menuWords(t, d, facts.counters);
  if (facts.set === 'venue' && !d.tour && d.whoCooks === 'kitchen') {
    sentences.push(food ? t('ask.write.kitchenFood', { food }) : t('ask.write.kitchen'));
  }
  if (facts.set === 'caterer') {
    if (food) sentences.push(t('ask.write.catererFood', { food }));
    if (d.tasting === true) sentences.push(t('ask.write.tasting'));
  }

  // One plain question to end on
  if (d.tour) {
    sentences.push(
      d.visitDays.length > 0
        ? t('ask.write.visitOn', {
            days: listOf(d.visitDays.map(shortDay), t('ask.write.or')),
            part: t(`ask.write.parts.${d.visitPart}`),
          })
        : t('ask.write.visit'),
    );
  } else if (facts.date && facts.eventDates.length < 2) {
    sentences.push(
      t('ask.write.priceAndDay', { day: ordinal(fromDateString(facts.date).getDate()) }),
    );
  } else if (facts.eventDates.length >= 2) {
    sentences.push(t('ask.write.priceAndDays'));
  } else {
    sentences.push(t('ask.write.price'));
  }
  return sentences.join(' ');
}
