import en from '@/i18n/en.json';

import { wedLine, type WedLineFacts } from './wed-line';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

/** The app's own strings, with {{name}} filled in, like useLocale().t. */
function t(key: string, options: Record<string, string | number> = {}) {
  const value = key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], en);
  if (typeof value !== 'string') throw new Error(`Missing string ${key}`);
  return value.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(options[name] ?? ''));
}

const facts = (patch: Partial<WedLineFacts>): WedLineFacts => ({
  event: 'Reception',
  band: null,
  status: 'unknown',
  hall: {},
  ...patch,
});

describe('wedLine', () => {
  it('says the hall fits their guests, and that it is hall only', () => {
    expect(
      wedLine(t, facts({ band: '100_250', hall: { seatedCapacity: 450, inHouseCatering: 'no' } })),
    ).toEqual({
      bold: 'Fits your 100 to 250 guests.',
      rest: "It's hall only, so you'd bring a caterer.",
    });
  });

  it('never promises a fit it cannot know', () => {
    // 450 seats for 250 to 500 guests: maybe, so just the seats
    expect(wedLine(t, facts({ band: '250_500', hall: { seatedCapacity: 450 } }))).toEqual({
      bold: 'Seats 450.',
      rest: '',
    });
    expect(wedLine(t, facts({ band: '500_plus', hall: { seatedCapacity: 300 } }))?.bold).toBe(
      'Seats 300, fewer than your 500+ guests.',
    );
  });

  it('leads with a booked day', () => {
    expect(
      wedLine(
        t,
        facts({ status: 'booked', hall: { seatedCapacity: 450, inHouseCatering: 'yes' } }),
      ),
    ).toEqual({ bold: 'Booked on your Reception, as of their calendar.', rest: 'Seats 450.' });
  });

  it("says who cooks in the hall's own terms", () => {
    const cooks = (inHouseCatering: string, outsideCatering?: string) =>
      wedLine(t, facts({ hall: { inHouseCatering, outsideCatering } }))?.bold;
    expect(cooks('yes', 'no')).toBe('They do all the food here.');
    expect(cooks('optional', 'approved_list')).toBe(
      'They cook, or you can bring a caterer from their list.',
    );
    expect(cooks('optional', 'yes')).toBe('They cook, or you can bring your own caterer.');
  });

  it('says nothing when there is nothing to say', () => {
    expect(wedLine(t, facts({}))).toBeNull();
    expect(wedLine(t, facts({ status: 'open' }))).toBeNull();
  });
});
