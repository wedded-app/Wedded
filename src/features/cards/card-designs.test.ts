import { cardDate } from './card-designs';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

describe('cardDate', () => {
  it('writes the day out in full and keeps it on the same day', () => {
    // new Date('2026-11-14') would be UTC midnight: the 13th in California.
    expect(cardDate('2026-11-14')).toBe('Saturday, November 14, 2026');
  });
});
