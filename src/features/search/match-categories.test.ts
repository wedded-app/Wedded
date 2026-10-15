import { editDistance, matchCategories } from './match-categories';

const categories = [
  { slug: 'dhol', name: { en: 'Dhol player' }, aliases: ['dhol', 'dholi'] },
  { slug: 'dholki-singers', name: { en: 'Dholki and sangeet singers' }, aliases: [] },
  {
    slug: 'mehndi-artist',
    name: { en: 'Mehndi artist' },
    aliases: ['henna', 'mehendi'],
  },
  {
    slug: 'banquet-hall',
    name: { en: 'Banquet hall' },
    aliases: ['hall', 'palace'],
  },
  { slug: 'community-center', name: { en: 'Community center' }, aliases: ['community hall'] },
  { slug: 'photographer', name: { en: 'Photographer' }, aliases: ['photos'] },
  { slug: 'caterer', name: { en: 'Caterer' }, aliases: ['catering', 'food'] },
];
const slugs = (text: string) => matchCategories(categories, text).map((c) => c.slug);

describe('matchCategories', () => {
  it('puts an exact alias first', () => {
    expect(slugs('dhol')).toEqual(['dhol', 'dholki-singers']);
  });

  it('matches the words parents use', () => {
    expect(slugs('henna')).toEqual(['mehndi-artist']);
    expect(slugs('palace')).toEqual(['banquet-hall']);
  });

  it('matches a word inside a longer name', () => {
    expect(slugs('hall')).toEqual(['banquet-hall', 'community-center']);
  });

  it('ignores case and extra spaces', () => {
    expect(slugs('  DHOL  ')).toEqual(slugs('dhol'));
  });

  it('matches nothing for empty or unknown text', () => {
    expect(slugs('')).toEqual([]);
    expect(slugs('   ')).toEqual([]);
    expect(slugs('zzz')).toEqual([]);
  });

  it('finds close spellings when nothing matches exactly', () => {
    expect(slugs('dhool')).toEqual(['dhol']);
    expect(slugs('mendhi')).toEqual(['mehndi-artist']);
    expect(slugs('photgrapher')).toEqual(['photographer']);
    expect(slugs('catring')).toEqual(['caterer']);
    expect(slugs('banquet haal')).toEqual(['banquet-hall']);
  });

  it('keeps exact matches free of close spellings', () => {
    // "hall" is exact for halls; it must not also bring in near words
    expect(slugs('hall')).toEqual(['banquet-hall', 'community-center']);
  });

  it('needs 4 letters before guessing', () => {
    expect(slugs('dhl')).toEqual([]);
  });
});

describe('editDistance', () => {
  it('counts added, removed and changed letters', () => {
    expect(editDistance('dhol', 'dhol')).toBe(0);
    expect(editDistance('dhool', 'dhol')).toBe(1);
    expect(editDistance('mendhi', 'mehndi')).toBe(2);
    expect(editDistance('', 'abc')).toBe(3);
  });
});
