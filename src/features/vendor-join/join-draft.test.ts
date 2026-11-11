import type { City } from '@/data/places';
import type { Category, CategoryGroup } from '@/data/reference';

import {
  getJoinDraft,
  joinProgress,
  kindOptions,
  resetJoinDraft,
  setJoinDraft,
  townChoice,
} from './join-draft';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const category = (slug: string, name: string, groupSlug: string, aliases: string[] = []) =>
  ({ slug, name: { en: name }, aliases, groupSlug }) as Category;

const CATEGORIES: Category[] = [
  category('dj', 'DJ', 'music', ['disc jockey']),
  category('dhol', 'Dhol player', 'music'),
  category('banquet-hall', 'Banquet hall', 'venues', ['hall']),
  category('caterer', 'Caterer', 'food'),
];

const GROUPS = [
  {
    slug: 'venues',
    name: { en: 'Venues' },
    categories: [{ slug: 'banquet-hall', name: { en: 'Banquet hall' }, groupSlug: 'venues' }],
  },
  {
    slug: 'music',
    name: { en: 'Music' },
    categories: [
      { slug: 'dhol', name: { en: 'Dhol player' }, groupSlug: 'music' },
      { slug: 'dj', name: { en: 'DJ' }, groupSlug: 'music' },
    ],
  },
] as CategoryGroup[];

const city = (slug: string, name: string, nicknames: string[] = []) =>
  ({ slug, name, nicknames, areaCode: '530', label: name, latitude: 0, longitude: 0 }) as City;

const CITIES: City[] = [
  city('yuba-city', 'Yuba City', ['yuba']),
  city('sacramento', 'Sacramento', ['sac']),
  city('san-jose', 'San Jose', ['sj']),
  city('santa-clara', 'Santa Clara'),
];

describe('kindOptions', () => {
  it('lists every kind in the founders order before anything is typed, ungrouped ones last', () => {
    expect(kindOptions(GROUPS, CATEGORIES, '').map((c) => c.slug)).toEqual([
      'banquet-hall',
      'dhol',
      'dj',
      'caterer',
    ]);
  });

  it('lists only the matching kinds once something is typed', () => {
    expect(kindOptions(GROUPS, CATEGORIES, 'hall').map((c) => c.slug)).toEqual(['banquet-hall']);
    expect(kindOptions(GROUPS, CATEGORIES, 'zzz')).toEqual([]);
  });
});

describe('townChoice', () => {
  it('picks the only match', () => {
    expect(townChoice(CITIES, 'yuba', null).picked?.slug).toBe('yuba-city');
  });

  it('waits for a tap when several match, unless one is spelled exactly', () => {
    expect(townChoice(CITIES, 'san', null)).toMatchObject({ picked: null });
    expect(townChoice(CITIES, 'san', null).matches).toHaveLength(2);
    expect(townChoice(CITIES, 'san jose', null).picked?.slug).toBe('san-jose');
  });

  it('keeps the one they tapped while it still matches', () => {
    expect(townChoice(CITIES, 'san', 'santa-clara').picked?.slug).toBe('santa-clara');
    expect(townChoice(CITIES, 'sac', 'santa-clara').picked?.slug).toBe('sacramento');
  });

  it('picks nothing before anything is typed', () => {
    expect(townChoice(CITIES, '  ', null)).toEqual({ matches: [], picked: null });
  });
});

describe('joinProgress', () => {
  it('fills a share per question and never fills up on a question', () => {
    expect(joinProgress('name')).toEqual({ from: 0, to: 0.25 });
    expect(joinProgress('town')).toEqual({ from: 0.5, to: 0.75 });
  });
});

describe('the draft', () => {
  it('keeps answers between screens until it is reset', () => {
    setJoinDraft({ name: 'Noor Mahal' });
    setJoinDraft({ categorySlug: 'banquet-hall' });
    expect(getJoinDraft()).toMatchObject({ name: 'Noor Mahal', categorySlug: 'banquet-hall' });
    resetJoinDraft();
    expect(getJoinDraft().name).toBe('');
  });
});
