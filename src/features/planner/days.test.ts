import {
  dayGroups,
  hasOwnDay,
  isJoined,
  joinDay,
  mainDay,
  setDay,
  shownDates,
  splitDay,
  type DayEvent,
} from './days';

const ORDER = ['mehndi', 'nikah', 'shadi', 'walima'];
const EVENTS: DayEvent[] = [
  { slug: 'mehndi', phase: 'before' },
  { slug: 'nikah', phase: 'wedding_day' },
  { slug: 'shadi', phase: 'wedding_day' },
  { slug: 'walima', phase: 'after' },
];
const EMPTY = { dates: {}, joined: [] };

describe('the wedding days', () => {
  it('gives each event its own day until two share one', () => {
    expect(dayGroups(ORDER, EMPTY)).toEqual([
      { slugs: ['mehndi'], date: null },
      { slugs: ['nikah'], date: null },
      { slugs: ['shadi'], date: null },
      { slugs: ['walima'], date: null },
    ]);
  });

  it('puts events next to each other on the same date on one day', () => {
    const groups = dayGroups(ORDER, {
      dates: { mehndi: '2027-06-11', nikah: '2027-06-12', shadi: '2027-06-12' },
      joined: [],
    });
    expect(groups).toEqual([
      { slugs: ['mehndi'], date: '2027-06-11' },
      { slugs: ['nikah', 'shadi'], date: '2027-06-12' },
      { slugs: ['walima'], date: null },
    ]);
    expect(isJoined(groups, 'shadi')).toBe(true);
    expect(isJoined(groups, 'nikah')).toBe(false);
  });

  it('joins two events before either has a day, and dates them together later', () => {
    const joined = joinDay(ORDER, EMPTY, 'walima');
    expect(dayGroups(ORDER, joined).map((g) => g.slugs)).toEqual([
      ['mehndi'],
      ['nikah'],
      ['shadi', 'walima'],
    ]);
    const dated = setDay(ORDER, joined, 'shadi', '2027-06-13');
    expect(dated).toEqual({ dates: { shadi: '2027-06-13', walima: '2027-06-13' }, joined: [] });
  });

  it("joins onto the day before's date, or brings its own date along", () => {
    const before = { dates: { nikah: '2027-06-12' }, joined: [] };
    expect(joinDay(ORDER, before, 'shadi').dates).toEqual({
      nikah: '2027-06-12',
      shadi: '2027-06-12',
    });
    const after = { dates: { shadi: '2027-06-13' }, joined: [] };
    expect(joinDay(ORDER, after, 'shadi').dates).toEqual({
      nikah: '2027-06-13',
      shadi: '2027-06-13',
    });
  });

  it("doesn't join the first event to anything", () => {
    expect(joinDay(ORDER, EMPTY, 'mehndi')).toBe(EMPTY);
  });

  it('splits an event and the ones after it onto a day of their own', () => {
    const state = {
      dates: { nikah: '2027-06-12', shadi: '2027-06-12', walima: '2027-06-12' },
      joined: [],
    };
    const split = splitDay(ORDER, state, 'shadi');
    expect(split.dates).toEqual({ nikah: '2027-06-12' });
    expect(dayGroups(ORDER, split).map((g) => g.slugs)).toEqual([
      ['mehndi'],
      ['nikah'],
      ['shadi'],
      ['walima'],
    ]);
    expect(splitDay(ORDER, state, 'nikah')).toBe(state);
  });

  it('clears a whole day at once, keeping its events together', () => {
    const state = { dates: { nikah: '2027-06-12', shadi: '2027-06-12' }, joined: [] };
    const cleared = setDay(ORDER, state, 'nikah', null);
    expect(cleared).toEqual({ dates: {}, joined: ['shadi'] });
    expect(dayGroups(ORDER, cleared).map((g) => g.slugs)).toEqual([
      ['mehndi'],
      ['nikah', 'shadi'],
      ['walima'],
    ]);
  });

  it('takes the main day from the first wedding-day event with a day', () => {
    expect(mainDay(EVENTS, { mehndi: '2027-06-11' })).toBeNull();
    expect(mainDay(EVENTS, { mehndi: '2027-06-11', shadi: '2027-06-13' })).toBe('2027-06-13');
    expect(mainDay(EVENTS, { nikah: '2027-06-12', shadi: '2027-06-13' })).toBe('2027-06-12');
  });

  it('shows the wedding date on the first wedding-day event until one has its own', () => {
    expect(shownDates(EVENTS, {}, '2027-06-12')).toEqual({ nikah: '2027-06-12' });
    expect(shownDates(EVENTS, { mehndi: '2027-06-11' }, '2027-06-12')).toEqual({
      mehndi: '2027-06-11',
      nikah: '2027-06-12',
    });
    expect(shownDates(EVENTS, { shadi: '2027-06-13' }, '2027-06-12')).toEqual({
      shadi: '2027-06-13',
    });
    expect(shownDates(EVENTS, undefined, null)).toEqual({});
  });

  it('leaves the Whole wedding card out of the days', () => {
    expect(hasOwnDay({ phase: 'whole_wedding' })).toBe(false);
    expect(hasOwnDay({ phase: 'before' })).toBe(true);
  });
});
