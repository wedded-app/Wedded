import { cardDate, cardPageHtml, cardTime } from './card-designs';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

describe('cardDate', () => {
  it('writes the day out in full and keeps it on the same day', () => {
    // new Date('2026-11-14') would be UTC midnight: the 13th in California.
    expect(cardDate('2026-11-14')).toBe('Saturday, November 14, 2026');
  });
});

describe('cardTime', () => {
  it('reads the way a card says it', () => {
    expect(cardTime('18:30:00')).toBe('6:30 PM');
    expect(cardTime('19:00:00')).toBe('7 PM');
    expect(cardTime('09:05:00')).toBe('9:05 AM');
    expect(cardTime('12:00:00')).toBe('12 PM');
    expect(cardTime('00:00:00')).toBe('12 AM');
  });
});

describe('cardPageHtml', () => {
  it('puts each card on a page of its own', () => {
    const html = cardPageHtml(['AAA', 'BBB']);
    expect(html.match(/class="page"/g)).toHaveLength(2);
    expect(html).toContain('data:image/png;base64,BBB');
  });
});
