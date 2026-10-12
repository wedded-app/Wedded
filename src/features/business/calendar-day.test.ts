import { dayLook } from './calendar-day';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

describe('dayLook', () => {
  it('is open with no marks', () => {
    expect(dayLook([])).toBe('open');
  });

  it('shows an all-day mark as the whole day', () => {
    expect(dayLook([{ part: 'all_day', status: 'booked' }])).toBe('booked');
    expect(dayLook([{ part: 'all_day', status: 'held' }])).toBe('held');
  });

  it('shows morning or evening marks as part of the day, booked first', () => {
    expect(dayLook([{ part: 'morning', status: 'held' }])).toBe('partHeld');
    expect(
      dayLook([
        { part: 'morning', status: 'held' },
        { part: 'evening', status: 'booked' },
      ]),
    ).toBe('partBooked');
  });
});
