import {
  budgetBands,
  budgetWords,
  initials,
  perGuest,
  shortName,
  timeAgo,
} from './requests-format';

const t = (key: string, options?: Record<string, string | number>) =>
  options ? `${key} ${JSON.stringify(options)}` : key;

describe('requests format', () => {
  it('offers per-guest budgets for venues and food only', () => {
    expect(budgetBands('venues')[0].key).toBe('pp_under_25');
    expect(budgetBands('food')).toHaveLength(4);
    expect(budgetBands('music')[1]).toEqual({ key: '500_1000', min: 500, max: 1000 });
    expect(perGuest('food')).toBe(true);
    expect(perGuest(null)).toBe(false);
  });

  it('words a budget', () => {
    expect(budgetWords(50000, 100000, t)).toBe('$500–1,000');
    expect(budgetWords(500000, null, t)).toBe('$5,000+');
    expect(budgetWords(null, 50000, t)).toBe('requests.budget.upTo {"amount":"$500"}');
    expect(budgetWords(null, null, t)).toBeNull();
    expect(budgetWords(2500, 5000, t, 'food')).toBe('requests.budget.perGuest {"budget":"$25–50"}');
  });

  it('says how long ago', () => {
    const now = new Date('2026-10-14T12:00:00Z');
    expect(timeAgo('2026-10-14T11:59:40Z', t, now)).toBe('requests.ago.now');
    expect(timeAgo('2026-10-14T11:55:00Z', t, now)).toBe('requests.ago.minutes {"count":5}');
    expect(timeAgo('2026-10-14T09:00:00Z', t, now)).toBe('requests.ago.hours {"count":3}');
    expect(timeAgo('2026-10-11T12:00:00Z', t, now)).toBe('requests.ago.days {"count":3}');
    expect(timeAgo('2026-09-30T12:00:00Z', t, now)).toBe('requests.ago.weeks {"count":2}');
    expect(timeAgo('2026-08-01T12:00:00Z', t, now)).toBe('Aug 1');
  });

  it('takes initials from a short name', () => {
    expect(initials('Harjit K.')).toBe('HK');
    expect(initials('Raj')).toBe('R');
    expect(initials('  ')).toBe('');
  });

  it('shortens a name to the first name and an initial', () => {
    expect(shortName('Harjit Kaur Sandhu')).toBe('Harjit S.');
    expect(shortName('Raj')).toBe('Raj');
    expect(shortName(null)).toBe('');
  });
});
