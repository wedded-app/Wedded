import { stillNeedsText } from './still-needs';

jest.mock('@/i18n/localized', () => ({ localized: (text: { en: string }) => text.en }));

const t = (key: string, options?: object) => `${key} ${JSON.stringify(options ?? {})}`;

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
