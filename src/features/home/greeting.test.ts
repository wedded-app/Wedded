import { greetingKey, stubParts, todayLine } from './greeting';

describe('greetingKey', () => {
  it('follows the time of day', () => {
    expect(greetingKey(new Date(2026, 9, 22, 8))).toBe('home.greeting.morning');
    expect(greetingKey(new Date(2026, 9, 22, 13))).toBe('home.greeting.afternoon');
    expect(greetingKey(new Date(2026, 9, 22, 20))).toBe('home.greeting.evening');
  });
});

describe('todayLine', () => {
  it('reads like a date stamp', () => {
    expect(todayLine(new Date(2026, 9, 22, 20))).toBe('THURSDAY · OCT 22');
  });
});

describe('stubParts', () => {
  it('splits a date for a ticket stub, whatever the time zone', () => {
    expect(stubParts('2027-06-11')).toEqual({ month: 'JUN', day: '11', weekday: 'FRI' });
  });

  it('has nothing without a date', () => {
    expect(stubParts(null)).toBeNull();
  });
});
