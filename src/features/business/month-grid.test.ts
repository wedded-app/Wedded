import { isoMonth, monthWeeks, nextStatus, shiftMonth } from './month-grid';

describe('monthWeeks', () => {
  it('starts on Sunday and pads the first and last weeks', () => {
    // October 2026 starts on a Thursday and has 31 days.
    const weeks = monthWeeks('2026-10');
    expect(weeks[0]).toEqual([null, null, null, null, '2026-10-01', '2026-10-02', '2026-10-03']);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks.flat().filter(Boolean)).toHaveLength(31);
    // The 31st is a Saturday, so the last week ends on it.
    expect(weeks[weeks.length - 1][6]).toBe('2026-10-31');
    // November starts on a Sunday and ends on a Monday: the last week is padded.
    expect(monthWeeks('2026-11').slice(-1)[0].slice(2)).toEqual([null, null, null, null, null]);
  });

  it('handles February in a leap year', () => {
    expect(monthWeeks('2028-02').flat().filter(Boolean)).toHaveLength(29);
  });
});

describe('shiftMonth and isoMonth', () => {
  it('crosses year boundaries', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2027-01', -1)).toBe('2026-12');
    expect(isoMonth(new Date(2026, 9, 5))).toBe('2026-10');
  });
});

describe('nextStatus', () => {
  it('cycles open, booked, held', () => {
    expect(nextStatus('open')).toBe('booked');
    expect(nextStatus('booked')).toBe('held');
    expect(nextStatus('held')).toBe('open');
  });
});
