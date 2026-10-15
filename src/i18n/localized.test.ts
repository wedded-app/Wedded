import { asLocalizedText, localized } from './localized';

describe('localized', () => {
  it('shows the English name', () => {
    expect(localized({ en: 'Jaago' })).toBe('Jaago');
  });
});

describe('asLocalizedText', () => {
  it('reads a database name', () => {
    expect(asLocalizedText({ en: 'Drone' })).toEqual({ en: 'Drone' });
  });

  it('keeps only the English when an old row still has another language', () => {
    expect(asLocalizedText({ en: 'Jaago', pa: 'x' })).toEqual({ en: 'Jaago' });
  });

  it('returns null for anything else', () => {
    expect(asLocalizedText(null)).toBeNull();
    expect(asLocalizedText('Jaago')).toBeNull();
    expect(asLocalizedText(['Jaago'])).toBeNull();
    expect(asLocalizedText({ pa: 'x' })).toBeNull();
  });
});
