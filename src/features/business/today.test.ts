import {
  mergeMonths,
  nextBooking,
  nextMonth,
  oldestWaiting,
  upcomingDays,
  weekDays,
} from './today';

describe('nextMonth', () => {
  it('moves to the next month, and the next year after December', () => {
    expect(nextMonth('2026-10-15')).toBe('2026-11');
    expect(nextMonth('2026-12-31')).toBe('2027-01');
  });
});

describe('upcomingDays', () => {
  const booked = { part: 'all_day', status: 'booked' } as const;
  const held = { part: 'evening', status: 'held' } as const;

  it('keeps today and later, soonest first, across months', () => {
    const october = { '2026-10-20': [held], '2026-10-01': [booked], '2026-10-15': [booked] };
    const november = { '2026-11-02': [booked] };
    expect(upcomingDays([november, october], '2026-10-15').map((d) => d.day)).toEqual([
      '2026-10-15',
      '2026-10-20',
      '2026-11-02',
    ]);
  });

  it('stops at the limit and skips months that have not loaded', () => {
    const october = { '2026-10-16': [booked], '2026-10-17': [booked], '2026-10-18': [held] };
    expect(upcomingDays([october, undefined], '2026-10-15', 2)).toEqual([
      { day: '2026-10-16', marks: [booked] },
      { day: '2026-10-17', marks: [booked] },
    ]);
  });
});

describe('weekDays', () => {
  it('counts seven days on, across a month end', () => {
    expect(weekDays('2026-10-28')).toEqual([
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
    ]);
  });
});

describe('nextBooking', () => {
  const booked = { part: 'all_day', status: 'booked' } as const;
  const held = { part: 'all_day', status: 'held' } as const;
  const evening = { part: 'evening', status: 'booked' } as const;

  it('skips held days and days gone by', () => {
    const october = { '2026-10-10': [booked], '2026-10-20': [held] };
    const november = { '2026-11-03': [evening] };
    expect(nextBooking([october, november], '2026-10-15')).toBe('2026-11-03');
    expect(mergeMonths([october, undefined, november])).toEqual({ ...october, ...november });
  });

  it('is null with nothing booked', () => {
    expect(nextBooking([{ '2026-10-20': [held] }], '2026-10-15')).toBeNull();
  });
});

describe('oldestWaiting', () => {
  it('finds the oldest family still waiting', () => {
    const leads = [
      { id: 'a', createdAt: '2026-10-20T10:00:00Z', replied: true },
      { id: 'b', createdAt: '2026-10-21T10:00:00Z', replied: false },
      { id: 'c', createdAt: '2026-10-22T10:00:00Z', replied: false },
    ];
    expect(oldestWaiting(leads)?.id).toBe('b');
    expect(oldestWaiting([leads[0]])).toBeNull();
  });
});
