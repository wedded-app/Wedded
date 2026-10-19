import type { HomeSection, NeedsByEvent } from '@/data/reference';

import { bookFirstNeeds, cheapestPrice, shortDate } from './book-first';

const need = (categorySlug: string, groupSlug: string) => ({
  categorySlug,
  groupSlug,
  name: { en: categorySlug },
});

const event = (slug: string, isCore = true) => ({
  slug,
  name: { en: slug },
  isCore,
  vendorTypeCount: 0,
  vendorCount: 0,
});

const sections: HomeSection[] = [
  { phase: 'before', events: [event('mehndi'), event('jaago'), event('chunni', false)] },
  { phase: 'wedding_day', events: [event('anand-karaj')] },
  { phase: 'after', events: [event('reception')] },
];

const essential = (...needs: ReturnType<typeof need>[]) => [{ importance: 'essential', needs }];

const needs: NeedsByEvent = {
  mehndi: essential(need('photographer', 'photo-video'), need('mehndi-artist', 'beauty')),
  jaago: essential(need('dhol', 'music'), need('photographer', 'photo-video')),
  chunni: essential(need('jeweller', 'attire'), need('jeweller-2', 'attire')),
  'anand-karaj': essential(
    need('gurdwara', 'venues'),
    need('photographer', 'photo-video'),
    need('videographer', 'photo-video'),
  ),
  reception: [
    ...essential(
      need('banquet-hall', 'venues'),
      need('dj', 'music'),
      need('photographer', 'photo-video'),
    ),
    { importance: 'nice_to_have', needs: [need('photo-booth', 'photo-video')] },
  ],
};

describe('bookFirstNeeds', () => {
  it('puts the venue first, then the groups the main events need most', () => {
    expect(bookFirstNeeds(sections, needs).map((n) => n.categorySlug)).toEqual([
      'gurdwara',
      'photographer',
      'dhol',
      'mehndi-artist',
    ]);
  });

  it('counts how many main events need each kind', () => {
    const photographer = bookFirstNeeds(sections, needs).find(
      (n) => n.categorySlug === 'photographer',
    );
    expect(photographer?.events).toBe(4);
  });

  it('leaves out events that are not main ones, and nice-to-haves', () => {
    const slugs = bookFirstNeeds(sections, needs, 10).map((n) => n.categorySlug);
    expect(slugs).not.toContain('jeweller');
    expect(slugs).not.toContain('photo-booth');
  });

  it('stops at the limit', () => {
    expect(bookFirstNeeds(sections, needs, 2)).toHaveLength(2);
  });
});

describe('cheapestPrice', () => {
  it('takes the lowest price in the way most of them price', () => {
    expect(
      cheapestPrice([
        { startingPrice: { amount: 4000, unit: 'event' } },
        { startingPrice: { amount: 65, unit: 'plate' } },
        { startingPrice: { amount: 55, unit: 'plate' } },
        { startingPrice: null },
      ]),
    ).toEqual({ amount: 55, unit: 'plate' });
  });

  it('is null when nobody shows a price', () => {
    expect(cheapestPrice([{ startingPrice: null }])).toBeNull();
  });
});

describe('shortDate', () => {
  it('names the month and day', () => {
    expect(shortDate('2027-06-12')).toBe('Jun 12');
  });
});
