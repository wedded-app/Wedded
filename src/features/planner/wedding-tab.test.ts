import type { EventGuestSummary } from '@/data/guests';
import type { WeddingMember } from '@/data/wedding';

import {
  comingLine,
  countdown,
  countdownText,
  daysLine,
  eventsLine,
  faceList,
  initials,
  weddingDays,
  whenLine,
} from './wedding-tab';

const t = (key: string, options?: object) => `${key} ${JSON.stringify(options ?? {})}`;

describe('initials', () => {
  it('takes the first and last names', () => {
    expect(initials('Asha Kaur')).toBe('AK');
    expect(initials('  harpreet singh gill ')).toBe('HG');
    expect(initials('Mom')).toBe('M');
  });

  it('shows a question mark without a name', () => {
    expect(initials(null)).toBe('?');
    expect(initials(' ')).toBe('?');
  });
});

describe('weddingDays', () => {
  it('puts the wedding date and the chosen events’ own days in order, once each', () => {
    expect(
      weddingDays(
        '2027-06-12',
        {
          mehndi: '2027-06-10',
          anand_karaj: '2027-06-12',
          jaago: '2027-06-11',
          roka: '2027-01-02',
        },
        ['mehndi', 'jaago', 'anand_karaj'],
      ),
    ).toEqual(['2027-06-10', '2027-06-11', '2027-06-12']);
  });

  it('works with only the wedding date, or only event days', () => {
    expect(weddingDays('2027-06-12', undefined, ['mehndi'])).toEqual(['2027-06-12']);
    expect(weddingDays(null, { jaago: '2027-06-11' }, ['jaago'])).toEqual(['2027-06-11']);
    expect(weddingDays(null, {}, ['jaago'])).toEqual([]);
  });
});

describe('daysLine', () => {
  it('is null with no days', () => {
    expect(daysLine([])).toBeNull();
  });

  it('shows one day', () => {
    expect(daysLine(['2027-06-11'])).toBe('JUN 11, 2027');
  });

  it('runs the days of one month together', () => {
    expect(daysLine(['2027-06-11', '2027-06-12'])).toBe('JUN 11–12, 2027');
  });

  it('names both months, and both years when it crosses one', () => {
    expect(daysLine(['2027-05-30', '2027-06-02'])).toBe('MAY 30 – JUN 2, 2027');
    expect(daysLine(['2026-12-30', '2027-01-02'])).toBe('DEC 30, 2026 – JAN 2, 2027');
  });
});

describe('countdown', () => {
  const today = new Date(2026, 9, 23); // 23 October 2026, local time

  it('counts to the wedding date, else the first day', () => {
    expect(countdown(['2026-11-01', '2026-11-03'], '2026-11-03', today)).toEqual({
      kind: 'toGo',
      days: 11,
    });
    expect(countdown(['2026-11-01', '2026-11-03'], null, today)).toEqual({
      kind: 'toGo',
      days: 9,
    });
  });

  it('is today from the day until the last one, then over', () => {
    expect(countdown(['2026-10-23'], '2026-10-23', today)).toEqual({ kind: 'today' });
    expect(countdown(['2026-10-22', '2026-10-24'], '2026-10-22', today)).toEqual({
      kind: 'today',
    });
    expect(countdown(['2026-10-20', '2026-10-21'], '2026-10-21', today)).toEqual({
      kind: 'over',
    });
  });

  it('is null with no days', () => {
    expect(countdown([], null, today)).toBeNull();
  });
});

describe('countdownText', () => {
  it('says each in words', () => {
    expect(countdownText({ kind: 'toGo', days: 232 }, t)).toBe('planner.toGo {"count":232}');
    expect(countdownText({ kind: 'today' }, t)).toBe('planner.today {}');
    expect(countdownText({ kind: 'over' }, t)).toBe('planner.married {}');
  });
});

describe('eventsLine', () => {
  it('is null with no events', () => {
    expect(eventsLine(0, null, false, t)).toBeNull();
  });

  it('says which comes first, or that everything is booked', () => {
    expect(eventsLine(3, 'Mehndi', false, t)).toBe(
      'planner.eventsFirst {"count":3,"first":"Mehndi"}',
    );
    expect(eventsLine(3, 'Mehndi', true, t)).toBe('planner.eventsAllBooked {"count":3}');
    expect(eventsLine(2, null, false, t)).toBe('planner.eventsCount {"count":2}');
  });
});

describe('faceList', () => {
  const member = (userId: string, name: string | null, isMe = false): WeddingMember => ({
    userId,
    name,
    isMe,
    role: 'editor',
  });

  it('shows everyone when they fit', () => {
    expect(faceList([member('a', 'Asha Kaur', true), member('b', 'Dev Singh')])).toEqual({
      faces: [
        { key: 'a', letters: 'AK', isMe: true },
        { key: 'b', letters: 'DS', isMe: false },
      ],
      more: 0,
    });
  });

  it('keeps the last circle for how many more there are', () => {
    const five = ['a', 'b', 'c', 'd', 'e'].map((id) => member(id, id));
    const list = faceList(five);
    expect(list.faces.map((face) => face.key)).toEqual(['a', 'b']);
    expect(list.more).toBe(3);
  });

  it('is empty with no one', () => {
    expect(faceList([])).toEqual({ faces: [], more: 0 });
  });
});

describe('whenLine', () => {
  it('joins the time and the place', () => {
    expect(whenLine('18:00', 'Royal Orchard, Yuba City')).toBe(
      '6:00 PM · Royal Orchard, Yuba City',
    );
    expect(whenLine('09:30', undefined)).toBe('9:30 AM');
    expect(whenLine(undefined, ' Gurdwara Sahib ')).toBe('Gurdwara Sahib');
  });

  it('is null when neither is known', () => {
    expect(whenLine(undefined, '  ')).toBeNull();
  });
});

describe('comingLine', () => {
  const summary = (peopleInvited: number, coming: number): EventGuestSummary => ({
    eventSlug: 'reception',
    invited: peopleInvited,
    yes: 0,
    no: 0,
    pending: 0,
    peopleInvited,
    coming,
  });

  it('is null before anyone is invited', () => {
    expect(comingLine(undefined, t)).toBeNull();
    expect(comingLine(summary(0, 0), t)).toBeNull();
  });

  it('says how many are coming, or invited until someone says yes', () => {
    expect(comingLine(summary(48, 31), t)).toBe('guests.comingCount {"count":31}');
    expect(comingLine(summary(48, 0), t)).toBe('guests.invitedCount {"count":48}');
  });
});
