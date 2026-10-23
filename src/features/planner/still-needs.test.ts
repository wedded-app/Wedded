import type { EventNeed } from '@/data/reference';

import { bookedNames, bookedText, stillNeedsText, unbookedNames } from './still-needs';

jest.mock('@/i18n/localized', () => ({ localized: (text: { en: string }) => text.en }));

const t = (key: string, options?: object) => `${key} ${JSON.stringify(options ?? {})}`;

const need = (categorySlug: string, name: string): EventNeed => ({
  categorySlug,
  name: { en: name },
  groupSlug: 'music',
});

describe('stillNeedsText', () => {
  it('says All set when nothing is left', () => {
    expect(stillNeedsText([], t)).toBe('home.events.allSet {}');
  });

  it('names one or two things', () => {
    expect(stillNeedsText(['dj', 'cake'], t)).toBe('home.events.toBook {"what":"dj, cake"}');
  });

  it('names the first and counts the rest', () => {
    expect(stillNeedsText(['mehndi artist', 'decor', 'dhol'], t)).toBe(
      'home.events.toBookMore {"what":"mehndi artist","count":2}',
    );
  });
});

describe('unbookedNames', () => {
  it('lists what is not booked yet, in lowercase', () => {
    expect(unbookedNames([need('dj', 'DJ'), need('cake', 'Cake')], ['dj'])).toEqual(['cake']);
  });
});

describe('bookedNames', () => {
  const needs = [need('venue', 'Venue'), need('caterer', 'Caterer'), need('dj', 'DJ')];

  it('names the vendor where the booking names one, first, in the order of the needs', () => {
    const vendors: Record<string, string> = { dj: 'DJ Sunny' };
    expect(bookedNames(needs, ['dj', 'caterer', 'venue'], (slug) => vendors[slug] ?? null)).toEqual(
      ['DJ Sunny', 'venue', 'caterer'],
    );
  });

  it('keeps a kind the event does not list only when a vendor is named', () => {
    const vendors: Record<string, string> = { photographer: 'Lens & Light' };
    expect(bookedNames(needs, ['cake', 'photographer'], (slug) => vendors[slug] ?? null)).toEqual([
      'Lens & Light',
    ]);
  });

  it('is empty with nothing booked', () => {
    expect(bookedNames(needs, [], () => null)).toEqual([]);
  });
});

describe('bookedText', () => {
  it('is null when nothing is booked', () => {
    expect(bookedText([], t)).toBeNull();
  });

  it('names one or two', () => {
    expect(bookedText(['Royal Orchard', 'caterer'], t)).toBe(
      'planner.ticket.booked {"names":"Royal Orchard, caterer"}',
    );
  });

  it('names the first and counts the rest', () => {
    expect(bookedText(['Royal Orchard', 'DJ Sunny', 'caterer'], t)).toBe(
      'planner.ticket.bookedMore {"names":"Royal Orchard","count":2}',
    );
  });
});
