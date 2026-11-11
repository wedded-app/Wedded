import { likelyEvent } from './ask-plan';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const needs = (essential: string[], nice: string[] = []) => [
  {
    importance: 'essential',
    needs: essential.map((categorySlug) => ({ categorySlug, name: { en: '' }, groupSlug: '' })),
  },
  {
    importance: 'nice_to_have',
    needs: nice.map((categorySlug) => ({ categorySlug, name: { en: '' }, groupSlug: '' })),
  },
];

const chosen = [
  { slug: 'sangeet' },
  { slug: 'anand-karaj' },
  { slug: 'doli' },
  { slug: 'reception' },
];
const needsByEvent = {
  sangeet: needs(['banquet-hall', 'dj']),
  'anand-karaj': needs(['gurdwara'], ['banquet-hall']),
  doli: needs(['cars-limos', 'photographer']),
  reception: needs(['banquet-hall', 'caterer', 'photographer']),
};

describe('likelyEvent', () => {
  it('picks the biggest event that needs this kind of vendor', () => {
    expect(
      likelyEvent(chosen, needsByEvent, ['banquet-hall'], {
        sangeet: '100_250',
        reception: '250_500',
      }),
    ).toBe('reception');
  });

  it('picks the wedding day or what follows it when the sizes are the same', () => {
    const phased = [
      { slug: 'sangeet', phase: 'before', isCore: true },
      { slug: 'anand-karaj', phase: 'wedding_day', isCore: true },
      { slug: 'reception', phase: 'after', isCore: true },
    ];
    const band = { sangeet: '250_500', reception: '250_500' };
    expect(likelyEvent(phased, needsByEvent, ['banquet-hall'], band)).toBe('reception');
    expect(likelyEvent(phased, needsByEvent, ['photographer'], undefined)).toBe('reception');
    expect(
      likelyEvent(
        phased,
        { ...needsByEvent, 'anand-karaj': needs(['photographer']) },
        ['photographer'],
        undefined,
      ),
    ).toBe('anand-karaj');
  });

  it('keeps ceremony order when the sizes are the same or unknown', () => {
    expect(likelyEvent(chosen, needsByEvent, ['banquet-hall'], undefined)).toBe('sangeet');
    expect(likelyEvent(chosen, needsByEvent, ['photographer'], { doli: 'not_sure' })).toBe('doli');
  });

  it('honours the event they came from only when it needs this kind', () => {
    expect(likelyEvent(chosen, needsByEvent, ['banquet-hall'], undefined, 'reception')).toBe(
      'reception',
    );
    // A hall from the Doli's page is still for an event that has a hall
    expect(likelyEvent(chosen, needsByEvent, ['banquet-hall'], undefined, 'doli')).toBe('sangeet');
  });

  it('falls back to nice to have, then the event they came from, then none', () => {
    expect(likelyEvent([{ slug: 'anand-karaj' }], needsByEvent, ['banquet-hall'], undefined)).toBe(
      'anand-karaj',
    );
    expect(likelyEvent(chosen, needsByEvent, ['mehndi-artist'], undefined, 'doli')).toBe('doli');
    expect(likelyEvent(chosen, needsByEvent, ['mehndi-artist'], undefined)).toBeNull();
    expect(likelyEvent([], needsByEvent, ['banquet-hall'], undefined)).toBeNull();
  });
});
