import type { NeedsByEvent, Tradition, TraditionEvent } from '@/data/reference';

import {
  activeTraditions,
  bookedCount,
  chosenEvents,
  daysUntil,
  mergedEvents,
  nextToBook,
  pickTradition,
  planProgress,
  signatureEvents,
  startingEvents,
  type WeddingPlan,
} from './plan-helpers';

const event = (
  slug: string,
  phase: string,
  order: number,
  isCore = true,
  name = slug,
): TraditionEvent => ({
  slug,
  name: { en: name },
  phase,
  order,
  isCore,
  timing: null,
  vendorTypeCount: 0,
  vendorCount: 0,
});

const sikh: Tradition = {
  slug: 'punjabi-sikh',
  name: { en: 'Punjabi Sikh' },
  isDefault: true,
  backgroundSlug: 'punjabi',
  faithSlug: 'sikh',
  events: [
    event('mehndi', 'before', 6),
    event('jaago', 'before', 8),
    event('milni', 'wedding_day', 12, false),
    event('reception', 'wedding_day', 17),
    event('whole-wedding', 'whole_wedding', 19),
  ],
};

const pakistani: Tradition = {
  slug: 'pakistani',
  name: { en: 'Pakistani' },
  isDefault: false,
  backgroundSlug: 'pakistani',
  faithSlug: 'muslim',
  events: [
    event('maiyan', 'before', 3, true, 'Mayun'),
    event('mehndi', 'before', 4),
    event('nikah', 'wedding_day', 5),
    event('walima', 'after', 8),
    event('whole-wedding', 'whole_wedding', 9),
  ],
};

const plan = (overrides: Partial<WeddingPlan> = {}): WeddingPlan => ({
  weddingDate: null,
  traditions: [],
  events: [],
  booked: {},
  ...overrides,
});

const need = (categorySlug: string) => ({
  categorySlug,
  name: { en: categorySlug },
  groupSlug: 'services',
});

const needs: NeedsByEvent = {
  mehndi: [
    { importance: 'essential', needs: [need('mehndi-artist'), need('dj')] },
    { importance: 'nice_to_have', needs: [need('lighting')] },
  ],
  jaago: [{ importance: 'essential', needs: [need('dhol'), need('caterer')] }],
  reception: [{ importance: 'essential', needs: [need('banquet-hall')] }],
};

describe('daysUntil', () => {
  const today = new Date(2026, 8, 30); // 30 September 2026, local time

  it('counts whole days to a future date', () => {
    expect(daysUntil('2026-10-01', today)).toBe(1);
    expect(daysUntil('2027-06-13', today)).toBe(256);
  });

  it('is zero on the day and negative after', () => {
    expect(daysUntil('2026-09-30', today)).toBe(0);
    expect(daysUntil('2026-09-28', today)).toBe(-2);
  });
});

describe('bookedCount', () => {
  it('adds up booked types for the events in the plan only', () => {
    expect(
      bookedCount(
        plan({
          events: ['jaago', 'reception'],
          booked: { jaago: ['dhol', 'caterer'], reception: ['dj'], mehndi: ['mehndi-artist'] },
        }),
      ),
    ).toBe(3);
  });
});

describe('activeTraditions', () => {
  it('uses the default tradition until the family picks', () => {
    expect(activeTraditions(plan(), [pakistani, sikh]).map((t) => t.slug)).toEqual([
      'punjabi-sikh',
    ]);
  });

  it('keeps the founders order for the ones picked', () => {
    expect(
      activeTraditions(plan({ traditions: ['pakistani', 'punjabi-sikh'] }), [sikh, pakistani]).map(
        (t) => t.slug,
      ),
    ).toEqual(['punjabi-sikh', 'pakistani']);
  });
});

describe('pickTradition', () => {
  it('replaces the stand-in default with the first pick', () => {
    expect(pickTradition([], ['punjabi-sikh'], 'pakistani')).toEqual(['pakistani']);
  });

  it('adds and removes once the family has picked', () => {
    expect(pickTradition(['pakistani'], ['pakistani'], 'punjabi-sikh')).toEqual([
      'pakistani',
      'punjabi-sikh',
    ]);
    expect(pickTradition(['pakistani', 'arab'], ['pakistani', 'arab'], 'arab')).toEqual([
      'pakistani',
    ]);
  });

  it('keeps at least one', () => {
    expect(pickTradition(['arab'], ['arab'], 'arab')).toBeNull();
    expect(pickTradition([], ['punjabi-sikh'], 'punjabi-sikh')).toBeNull();
  });
});

describe('mergedEvents', () => {
  it('lists each event once, in ceremony order, with the whole wedding last', () => {
    expect(mergedEvents([sikh, pakistani]).map((e) => e.slug)).toEqual([
      'maiyan',
      'mehndi',
      'jaago',
      'nikah',
      'milni',
      'reception',
      'walima',
      'whole-wedding',
    ]);
  });

  it("uses the first tradition's name and marks shared main events", () => {
    const withMainMilni: Tradition = {
      ...pakistani,
      events: [event('milni', 'wedding_day', 1, true, 'Milni here')],
    };
    const milni = mergedEvents([sikh, withMainMilni]).find((e) => e.slug === 'milni');
    expect(milni?.name.en).toBe('milni');
    expect(milni?.isCore).toBe(true);
  });
});

describe('startingEvents', () => {
  it('starts a plan with the main events of every picked tradition, once each', () => {
    expect(startingEvents([sikh, pakistani])).toEqual([
      'maiyan',
      'mehndi',
      'jaago',
      'nikah',
      'reception',
      'walima',
      'whole-wedding',
    ]);
  });

  it('starts empty when no tradition was picked', () => {
    expect(startingEvents([])).toEqual([]);
  });
});

describe('signatureEvents', () => {
  it('shows the last main event before the day, then the day itself', () => {
    expect(signatureEvents(sikh).map((e) => e.slug)).toEqual(['jaago', 'reception']);
  });

  it('keeps the first event after the day, giving up the day itself for room', () => {
    expect(signatureEvents(pakistani).map((e) => e.slug)).toEqual(['mehndi', 'nikah', 'walima']);
    expect(signatureEvents(pakistani, 2).map((e) => e.slug)).toEqual(['mehndi', 'walima']);
  });
});

describe('chosenEvents, planProgress and nextToBook', () => {
  const events = mergedEvents([sikh]);
  const p = plan({
    events: ['reception', 'mehndi', 'jaago', 'nikah'],
    booked: { mehndi: ['mehndi-artist', 'lighting'], jaago: ['dhol'] },
  });
  const chosen = chosenEvents(p, events);

  it('keeps ceremony order and drops events outside the traditions', () => {
    expect(chosen.map((e) => e.slug)).toEqual(['mehndi', 'jaago', 'reception']);
  });

  it('counts the essentials of the chosen events only', () => {
    // mehndi-artist and dhol; lighting is only nice to have
    expect(planProgress(p, chosen, needs)).toEqual({ done: 2, total: 5 });
  });

  it('suggests unbooked essentials, soonest event first', () => {
    expect(
      nextToBook(p, chosen, needs).map((n) => `${n.eventSlug}:${n.need.categorySlug}`),
    ).toEqual(['mehndi:dj', 'jaago:caterer', 'reception:banquet-hall']);
    expect(nextToBook(p, chosen, needs, 1)).toHaveLength(1);
  });
});
