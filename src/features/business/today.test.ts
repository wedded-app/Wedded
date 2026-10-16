import { nextMonth, upcomingDays } from './today';

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
