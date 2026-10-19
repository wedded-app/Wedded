import type { Guest } from '@/data/guests';

import {
  answerLabel,
  contactToGuest,
  guestTotals,
  matchesSearch,
  totalsLine,
} from './guest-helpers';

const guest = (partySize: number, coming: (number | null)[]): Guest => ({
  id: String(Math.random()),
  name: 'Guest',
  phone: null,
  email: null,
  partySize,
  rsvpToken: 'token',
  invites: coming.map((count, i) => ({
    eventSlug: `event-${i}`,
    rsvp: count === null ? 'pending' : count > 0 ? 'yes' : 'no',
    coming: count,
    answeredAt: null,
  })),
  lastSentAt: null,
});

describe('guestTotals', () => {
  it('counts everyone in each household, and each person coming once', () => {
    expect(guestTotals([guest(4, [3, 4]), guest(2, [0, null]), guest(1, [])])).toEqual({
      people: 7,
      invited: 6,
      coming: 4,
    });
  });
});

describe('totalsLine', () => {
  const t = (key: string, options?: Record<string, string | number>) =>
    `${key} ${JSON.stringify(options)}`;
  it('says who is invited and coming, or how many are on the list so far', () => {
    expect(totalsLine([], t)).toBeNull();
    expect(totalsLine([guest(3, [])], t)).toBe('guests.onList {"count":3}');
    expect(totalsLine([guest(3, [2]), guest(1, [])], t)).toBe(
      'guests.totals {"invited":3,"coming":2}',
    );
  });
});

describe('contactToGuest', () => {
  it('keeps the name, the mobile number and a real email', () => {
    expect(
      contactToGuest({
        fullName: '  Harpreet   Kaur ',
        phones: [
          { label: 'home', number: '(916) 555-0100' },
          { label: 'mobile', number: '530 555 0101' },
        ],
        emails: [{ address: 'not an email' }, { address: ' Harpreet@Example.com ' }],
      }),
    ).toEqual({
      name: 'Harpreet Kaur',
      phone: '+15305550101',
      email: 'harpreet@example.com',
      partySize: 1,
    });
  });

  it('skips numbers that are not real and contacts without a name', () => {
    expect(contactToGuest({ fullName: 'Bhua ji', phones: [{ number: '123' }] })).toEqual({
      name: 'Bhua ji',
      phone: null,
      email: null,
      partySize: 1,
    });
    expect(contactToGuest({ fullName: ' ', phones: [{ number: '5305550101' }] })).toBeNull();
  });
});

describe('matchesSearch', () => {
  it('matches part of a name, or the digits of a number however it is spaced', () => {
    expect(matchesSearch('kaur', 'Harpreet Kaur')).toBe(true);
    expect(matchesSearch('5305550101', 'Mom', '(530) 555-0101')).toBe(true);
    expect(matchesSearch('singh', 'Harpreet Kaur', '(530) 555-0101')).toBe(false);
    expect(matchesSearch('', 'Anyone')).toBe(true);
  });
});

describe('answerLabel', () => {
  const t = (key: string, options?: Record<string, string | number>) =>
    options ? `${key} ${options.count}` : key;
  it('says who is coming and how many', () => {
    expect(answerLabel('yes', 4, t)).toBe('guests.answer.yes 4');
    expect(answerLabel('no', 0, t)).toBe('guests.answer.no');
    expect(answerLabel('pending', null, t)).toBe('guests.answer.pending');
  });
});
