import {
  applyChange,
  joinErrorKind,
  sortWeddings,
  toAccountWedding,
  toPlan,
  type AccountWedding,
} from './wedding';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/features/auth/session', () => ({ useSession: () => ({ session: null }) }));
jest.mock('expo-linking', () => ({ createURL: (path: string) => `exp://dev${path}` }));

const wedding: AccountWedding = {
  id: 'w1',
  title: null,
  weddingDate: '2027-06-12',
  role: 'owner',
  joinedAt: '2026-09-30T08:00:00Z',
  traditions: [],
  events: ['reception', 'jaago'],
  booked: { reception: ['banquet-hall'] },
  guests: { reception: '250_500' },
  eventDates: { reception: '2027-06-12' },
  eventTimes: { reception: '18:00' },
  eventPlaces: { reception: 'Royal Orchard, Yuba City' },
  bookedVendors: {},
};

describe('toAccountWedding', () => {
  it('turns the API rows into the plan shape', () => {
    expect(
      toAccountWedding({
        role: 'editor',
        joined_at: '2026-09-30T08:00:00Z',
        wedding: {
          id: 'w1',
          title: 'Jaspreet & Amrit',
          wedding_date: '2027-06-12',
          traditions: ['punjabi-sikh', 'pakistani'],
          wedding_events: [
            {
              event_slug: 'reception',
              event_date: '2027-06-12',
              start_time: '18:00:00',
              place: 'Royal Orchard, Yuba City',
              guest_band: '250_500',
              wedding_bookings: [
                { category_slug: 'dj', vendor: { slug: 'dj-sukh', name: 'DJ Sukh' } },
              ],
            },
            {
              event_slug: 'jaago',
              event_date: '2027-06-11',
              start_time: null,
              place: null,
              guest_band: null,
              wedding_bookings: [],
            },
          ],
        },
      }),
    ).toEqual({
      id: 'w1',
      title: 'Jaspreet & Amrit',
      weddingDate: '2027-06-12',
      role: 'editor',
      joinedAt: '2026-09-30T08:00:00Z',
      traditions: ['punjabi-sikh', 'pakistani'],
      events: ['reception', 'jaago'],
      booked: { reception: ['dj'] },
      guests: { reception: '250_500' },
      eventDates: { reception: '2027-06-12', jaago: '2027-06-11' },
      eventTimes: { reception: '18:00' },
      eventPlaces: { reception: 'Royal Orchard, Yuba City' },
      bookedVendors: { 'reception/dj': { slug: 'dj-sukh', name: 'DJ Sukh' } },
    });
  });

  it('skips a wedding that is gone or an unknown role', () => {
    expect(toAccountWedding({ role: 'owner', joined_at: '', wedding: null })).toBeNull();
  });
});

describe('sortWeddings', () => {
  it('puts their own wedding before ones they only view', () => {
    const cousins = { ...wedding, id: 'w2', role: 'suggester' as const, joinedAt: '2026-01-01' };
    expect(sortWeddings([cousins, wedding]).map((w) => w.id)).toEqual(['w1', 'w2']);
  });
});

describe('applyChange', () => {
  it('changes the date', () => {
    expect(applyChange(wedding, { kind: 'date', date: null }).weddingDate).toBeNull();
  });

  it('removing an event removes what was booked for it, its guest count, date, time and place', () => {
    const next = applyChange(wedding, { kind: 'event', slug: 'reception', on: false });
    expect(next.events).toEqual(['jaago']);
    expect(next.booked).toEqual({});
    expect(next.guests).toEqual({});
    expect(next.eventDates).toEqual({});
    expect(next.eventTimes).toEqual({});
    expect(next.eventPlaces).toEqual({});
  });

  it("sets the couple's names, and an event's start time and place", () => {
    expect(applyChange(wedding, { kind: 'title', title: 'Simran & Arjun' }).title).toBe(
      'Simran & Arjun',
    );
    const timed = applyChange(wedding, { kind: 'eventTime', event: 'jaago', time: '19:30' });
    expect(timed.eventTimes).toEqual({ reception: '18:00', jaago: '19:30' });
    const moved = applyChange(timed, { kind: 'eventPlace', event: 'reception', place: null });
    expect(moved.eventPlaces).toEqual({});
  });

  it("sets and clears an event's own date", () => {
    const set = applyChange(wedding, { kind: 'eventDate', event: 'jaago', date: '2027-06-11' });
    expect(set.eventDates).toEqual({ reception: '2027-06-12', jaago: '2027-06-11' });
    const cleared = applyChange(set, { kind: 'eventDate', event: 'reception', date: null });
    expect(cleared.eventDates).toEqual({ jaago: '2027-06-11' });
  });

  it("sets and clears an event's guest count", () => {
    const set = applyChange(wedding, { kind: 'guests', event: 'jaago', band: '100_250' });
    expect(set.guests).toEqual({ reception: '250_500', jaago: '100_250' });
    const cleared = applyChange(set, { kind: 'guests', event: 'reception', band: null });
    expect(cleared.guests).toEqual({ jaago: '100_250' });
  });

  it('adds an event once', () => {
    const next = applyChange(wedding, { kind: 'event', slug: 'jaago', on: true });
    expect(next.events).toEqual(['reception', 'jaago']);
  });

  it('sets the traditions', () => {
    expect(applyChange(wedding, { kind: 'traditions', slugs: ['arab'] }).traditions).toEqual([
      'arab',
    ]);
  });

  it('adds several events, skipping ones already there', () => {
    const next = applyChange(wedding, { kind: 'addEvents', slugs: ['jaago', 'mehndi', 'walima'] });
    expect(next.events).toEqual(['reception', 'jaago', 'mehndi', 'walima']);
  });

  it('ticks and unticks a booking', () => {
    const on = applyChange(wedding, { kind: 'booked', event: 'jaago', category: 'dhol', on: true });
    expect(on.booked.jaago).toEqual(['dhol']);
    const off = applyChange(on, { kind: 'booked', event: 'jaago', category: 'dhol', on: false });
    expect(off.booked.jaago).toEqual([]);
  });
});

describe('toPlan', () => {
  it('marks the phone copy as synced', () => {
    expect(toPlan(wedding).syncedWeddingId).toBe('w1');
  });
});

describe('joinErrorKind', () => {
  it('maps the database errors to messages', () => {
    expect(joinErrorKind(new Error('invite_expired'))).toBe('expired');
    expect(joinErrorKind(new Error('wedding_full'))).toBe('full');
    expect(joinErrorKind(new Error('network'))).toBe('failed');
  });
});
