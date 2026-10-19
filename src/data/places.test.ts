import { matchCities, type City } from './places';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const city = (name: string, nicknames: string[] = []): City => ({
  slug: name.toLowerCase().replace(/ /g, '-'),
  name,
  label: name,
  areaCode: '000',
  nicknames,
  latitude: 38,
  longitude: -121,
});

const cities = [
  city('San Jose', ['sj']),
  city('Sacramento', ['sac', 'sacto']),
  city('West Sacramento', ['west sac']),
  city('Santa Clara'),
  city('Yuba City', ['yuba']),
];

describe('matchCities', () => {
  it('puts names that start with the text first, then nicknames, then names that contain it', () => {
    expect(matchCities(cities, 'sac').map((c) => c.name)).toEqual([
      'Sacramento',
      'West Sacramento',
    ]);
    expect(matchCities(cities, 'sj').map((c) => c.name)).toEqual(['San Jose']);
    expect(matchCities(cities, 'city').map((c) => c.name)).toEqual(['Yuba City']);
  });

  it('ignores case and spaces, and returns nothing for empty text', () => {
    expect(matchCities(cities, '  YUBA ').map((c) => c.name)).toEqual(['Yuba City']);
    expect(matchCities(cities, '   ')).toEqual([]);
  });

  it('stops at the limit', () => {
    expect(matchCities(cities, 's', 2)).toHaveLength(2);
  });
});
