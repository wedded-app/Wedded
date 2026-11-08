import type { CategoryGroup, NeedsByEvent } from '@/data/reference';

import { browseKinds, filterGroups, isVenue, shelfKinds } from './vendors-tab';

const need = (categorySlug: string, groupSlug: string) => ({
  categorySlug,
  groupSlug,
  name: { en: categorySlug },
});

const essential = (...needs: ReturnType<typeof need>[]) => [{ importance: 'essential', needs }];

const needs: NeedsByEvent = {
  mehndi: essential(need('photographer', 'photo-video'), need('mehndi-artist', 'beauty')),
  jaago: essential(need('dhol', 'music'), need('photographer', 'photo-video')),
  'anand-karaj': essential(
    need('gurdwara', 'venues'),
    need('photographer', 'photo-video'),
    need('videographer', 'photo-video'),
  ),
  reception: [
    ...essential(
      need('banquet-hall', 'venues'),
      need('dj', 'music'),
      need('dhol', 'music'),
      need('photographer', 'photo-video'),
    ),
    { importance: 'nice_to_have', needs: [need('photo-booth', 'photo-video')] },
  ],
};

const events = ['mehndi', 'jaago', 'anand-karaj', 'reception'];

const groups: CategoryGroup[] = [
  {
    slug: 'venues',
    name: { en: 'Venues' },
    categories: [
      { slug: 'gurdwara', name: { en: 'Gurdwara' }, groupSlug: 'venues' },
      { slug: 'banquet-hall', name: { en: 'Banquet hall' }, groupSlug: 'venues' },
    ],
  },
  {
    slug: 'food',
    name: { en: 'Food' },
    categories: [
      { slug: 'caterer', name: { en: 'Caterer' }, groupSlug: 'food' },
      { slug: 'mithai', name: { en: 'Mithai and sweet boxes' }, groupSlug: 'food' },
    ],
  },
  {
    slug: 'beauty',
    name: { en: 'Beauty' },
    categories: [{ slug: 'makeup', name: { en: 'Makeup and hair' }, groupSlug: 'beauty' }],
  },
];

const slugs = (list: { categorySlug: string }[]) => list.map((item) => item.categorySlug);

describe('browseKinds', () => {
  it('puts a venue first, then the kinds the most events need, several per group', () => {
    expect(slugs(browseKinds(events, needs, [], 12))).toEqual([
      'gurdwara',
      'photographer',
      'dhol',
      'mehndi-artist',
      'videographer',
      'banquet-hall',
      'dj',
    ]);
  });

  it('leaves out nice-to-haves', () => {
    expect(slugs(browseKinds(events, needs, []))).not.toContain('photo-booth');
  });

  it('fills a short row from the database: each group first, then the rest', () => {
    expect(slugs(browseKinds(['mehndi'], needs, groups, 6))).toEqual([
      'photographer',
      'mehndi-artist',
      'gurdwara',
      'caterer',
      'makeup',
      'banquet-hall',
    ]);
  });

  it('stops at the limit', () => {
    expect(browseKinds(events, needs, groups, 3)).toHaveLength(3);
  });
});

describe('shelfKinds', () => {
  it('gives one kind per group, the venue first', () => {
    expect(slugs(shelfKinds(events, needs, {}))).toEqual([
      'gurdwara',
      'photographer',
      'dhol',
      'mehndi-artist',
    ]);
  });

  it('drops a kind once it is booked for every event that needs it', () => {
    const booked = { 'anand-karaj': ['gurdwara'], reception: ['banquet-hall'] };
    expect(slugs(shelfKinds(events, needs, booked))).toEqual([
      'photographer',
      'dhol',
      'mehndi-artist',
    ]);
  });

  it('moves to the next kind in a group once one is booked everywhere', () => {
    const booked = { jaago: ['dhol'], reception: ['dhol'] };
    const shown = slugs(shelfKinds(events, needs, booked));
    expect(shown).toContain('dj');
    expect(shown).not.toContain('dhol');
  });
});

describe('isVenue', () => {
  it('is true only for the venues group', () => {
    expect(isVenue(need('banquet-hall', 'venues'))).toBe(true);
    expect(isVenue(need('dj', 'music'))).toBe(false);
  });
});

describe('filterGroups', () => {
  const aliases = { makeup: ['mua', 'bridal makeup'], caterer: ['khana'] };

  it('shows everything for empty text', () => {
    expect(filterGroups(groups, aliases, '  ')).toBe(groups);
  });

  it('matches names and other names, and drops empty groups', () => {
    const found = filterGroups(groups, aliases, 'MUA');
    expect(found.map((group) => group.slug)).toEqual(['beauty']);
    expect(filterGroups(groups, aliases, 'khana')[0].categories.map((c) => c.slug)).toEqual([
      'caterer',
    ]);
  });

  it('keeps a whole group when its own name matches', () => {
    expect(filterGroups(groups, aliases, 'food')[0].categories).toHaveLength(2);
  });

  it('finds nothing for text nothing has', () => {
    expect(filterGroups(groups, aliases, 'helicopter')).toEqual([]);
  });
});
