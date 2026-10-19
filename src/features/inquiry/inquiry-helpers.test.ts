import en from '@/i18n/en.json';

import {
  eventChips,
  formatDate,
  fromDateString,
  planDatesFor,
  suggestedMessage,
  toDateString,
} from './inquiry-helpers';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

/** The app's own strings, with {{name}} filled in, like useLocale().t. */
function translator(strings: Record<string, unknown>) {
  return (key: string, options: Record<string, string | number> = {}) => {
    const value = key
      .split('.')
      .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], strings);
    if (typeof value !== 'string') throw new Error(`Missing string ${key}`);
    return value.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(options[name] ?? ''));
  };
}

describe('dates', () => {
  it('keeps the calendar day the phone picked, with no time zone shift', () => {
    const picked = new Date(2027, 5, 13, 23, 30); // late evening, local time
    expect(toDateString(picked)).toBe('2027-06-13');
    expect(toDateString(fromDateString('2027-06-13'))).toBe('2027-06-13');
  });

  it('shows dates with Latin digits', () => {
    expect(formatDate('2027-06-13')).toBe('Sun, Jun 13, 2027');
  });
});

describe('planDatesFor', () => {
  const eventDates = { jaago: '2027-06-11', 'anand-karaj': '2027-06-12', roka: '2026-01-01' };

  it("starts with the earliest of the events' own days and lists each one", () => {
    expect(
      planDatesFor(
        ['anand-karaj', 'jaago'],
        eventDates,
        '2027-06-12',
        ['anand-karaj'],
        '2026-10-13',
      ),
    ).toEqual({
      start: '2027-06-11',
      dates: [
        { slug: 'anand-karaj', date: '2027-06-12' },
        { slug: 'jaago', date: '2027-06-11' },
      ],
    });
    expect(
      planDatesFor(['jaago', 'anand-karaj'], eventDates, '2027-06-12', [], '2026-10-13'),
    ).toEqual({
      start: '2027-06-11',
      dates: [
        { slug: 'jaago', date: '2027-06-11' },
        { slug: 'anand-karaj', date: '2027-06-12' },
      ],
    });
  });

  it('never gives another event the wedding day', () => {
    // A Roka with no date of its own starts empty, not on the wedding day
    expect(planDatesFor(['roka'], eventDates, '2027-06-12', ['anand-karaj'], '2026-10-13')).toEqual(
      { start: null, dates: [] },
    );
  });

  it('uses the wedding day for wedding-day events, or when no event is picked', () => {
    expect(
      planDatesFor(['reception'], {}, '2027-06-12', ['anand-karaj', 'reception'], '2026-10-13'),
    ).toEqual({ start: '2027-06-12', dates: [] });
    expect(planDatesFor([], undefined, '2027-06-12', [], '2026-10-13').start).toBe('2027-06-12');
    // A wedding day already past is left out
    expect(planDatesFor([], undefined, '2025-01-01', [], '2026-10-13').start).toBeNull();
  });
});

describe('suggestedMessage', () => {
  const events = [{ en: 'Jaago' }];

  it('names each event with its own day when they ask about several', () => {
    expect(
      suggestedMessage(translator(en), {
        events: [events[0], { en: 'Anand Karaj' }],
        date: '2027-06-11',
        place: 'Yuba City',
        guests: '100_250',
        eventDates: [
          { event: events[0], date: '2027-06-11' },
          { event: { en: 'Anand Karaj' }, date: '2027-06-12' },
        ],
      }),
    ).toBe(
      "Sat Sri Akal, we're planning our Jaago on Fri, Jun 11, 2027 and Anand Karaj on Sat, Jun 12, 2027 in Yuba City for about 100 to 250 guests. Could you share your price and whether you're available? Thank you.",
    );
  });

  it('writes the full sentence when date and guests are known', () => {
    expect(
      suggestedMessage(translator(en), {
        events,
        date: '2027-06-12',
        place: 'Yuba City',
        guests: '100_250',
      }),
    ).toBe(
      "Sat Sri Akal, we're planning our Jaago on Sat, Jun 12, 2027 in Yuba City for about 100 to 250 guests. Could you share your price and whether you're available? Thank you.",
    );
  });

  it('leaves out what they are not sure of', () => {
    expect(
      suggestedMessage(translator(en), {
        events: [],
        date: null,
        place: '',
        guests: 'not_sure',
      }),
    ).toBe(
      "Sat Sri Akal, we're planning a wedding in our city. Could you share your price? Thank you.",
    );
  });

  it('asks to visit for a tour', () => {
    expect(
      suggestedMessage(translator(en), {
        events: [{ en: 'Reception' }],
        date: '2027-06-13',
        place: 'Yuba City',
        guests: '500_plus',
        tour: true,
      }),
    ).toContain('would like to visit your hall');
  });
});

describe('eventChips', () => {
  const all = ['roka', 'jaago', 'anand-karaj', 'reception', 'sangeet'].map((slug) => ({ slug }));
  const slugs = (result: { shown: { slug: string }[] }) => result.shown.map((e) => e.slug);

  it('puts the event they came from first, then the vendor’s events', () => {
    const result = eventChips(all, ['reception'], ['jaago', 'reception', 'sangeet'], false);
    expect(slugs(result)).toEqual(['reception', 'jaago', 'sangeet']);
    expect(result.hasMore).toBe(true);
  });

  it('shows every event once expanded', () => {
    const result = eventChips(all, ['reception'], ['jaago'], true);
    expect(slugs(result)).toEqual(['roka', 'jaago', 'anand-karaj', 'reception', 'sangeet']);
    expect(result.hasMore).toBe(false);
  });

  it('shows every event when there is nothing to put first', () => {
    const result = eventChips(all, [], [], false);
    expect(result.shown).toHaveLength(5);
    expect(result.hasMore).toBe(false);
  });

  it('has no "Other events" when the vendor serves them all', () => {
    const result = eventChips(
      all,
      [],
      all.map((e) => e.slug),
      false,
    );
    expect(result.hasMore).toBe(false);
  });
});
