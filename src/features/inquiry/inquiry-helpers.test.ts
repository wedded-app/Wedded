import {
  eventChips,
  formatDate,
  fromDateString,
  planDatesFor,
  toDateString,
} from './inquiry-helpers';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

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
