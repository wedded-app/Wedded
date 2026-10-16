import { barShares, fixTarget, monthLabel, replyLine } from './insights-format';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

/** Echoes the key and its options, so the tests read the choices made. */
const t = (key: string, options: Record<string, string | number> = {}) =>
  Object.keys(options).length > 0 ? `${key}(${JSON.stringify(options)})` : key;

describe('insights words', () => {
  it('says how often and how fast they reply', () => {
    expect(replyLine({ leads: 0, replied: 0, rate: null, medianMinutes: null }, t)).toBeNull();
    expect(replyLine({ leads: 10, replied: 9, rate: 0.9, medianMinutes: null }, t)).toBe(
      'business.insights.replied({"replied":9,"leads":10})',
    );
    expect(replyLine({ leads: 10, replied: 9, rate: 0.9, medianMinutes: 125 }, t)).toBe(
      'business.insights.repliedWithin({"replied":"business.insights.replied({\\"replied\\":9,\\"leads\\":10})","within":"business.insights.within.hours({\\"count\\":2})"})',
    );
  });

  it('names a month', () => {
    expect(monthLabel('2027-06', t)).toBe('business.calendar.months.6 2027');
  });

  it('sends Fix it to the right place', () => {
    expect(fixTarget('calendar')).toBe('/business/calendar');
    expect(fixTarget('menus')).toBe('/business/menus');
    expect(fixTarget('bio')).toEqual({
      pathname: '/business/listing',
      params: { section: 'about' },
    });
    expect(fixTarget('contact')).toEqual({
      pathname: '/business/listing',
      params: { section: 'contact' },
    });
    expect(fixTarget('photos')).toBe('/business/photos');
    expect(fixTarget('cover')).toBe('/business/photos');
  });

  it('scales bars to the biggest value', () => {
    expect(barShares([0, 5, 10])).toEqual([0, 0.5, 1]);
    expect(barShares([0, 0])).toEqual([0, 0]);
    expect(barShares([])).toEqual([]);
  });
});
