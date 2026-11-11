import { bandForCount, countForBand, MAX_GUESTS, MIN_GUESTS, stepGuests } from './guest-count';

describe('bandForCount', () => {
  it('puts each count in the band the inquiry form uses', () => {
    expect(bandForCount(25)).toBe('under_50');
    expect(bandForCount(50)).toBe('50_100');
    expect(bandForCount(100)).toBe('50_100');
    expect(bandForCount(125)).toBe('100_250');
    expect(bandForCount(250)).toBe('100_250');
    expect(bandForCount(300)).toBe('250_500');
    expect(bandForCount(500)).toBe('250_500');
    expect(bandForCount(525)).toBe('500_plus');
  });

  it('starts a band they gave before inside that band', () => {
    for (const band of ['under_50', '50_100', '100_250', '250_500', '500_plus'] as const) {
      expect(bandForCount(countForBand(band))).toBe(band);
    }
  });
});

describe('stepGuests', () => {
  it('moves 25 at a time and stays in range', () => {
    expect(stepGuests(300, 1)).toBe(325);
    expect(stepGuests(300, -1)).toBe(275);
    expect(stepGuests(MIN_GUESTS, -1)).toBe(MIN_GUESTS);
    expect(stepGuests(MAX_GUESTS, 1)).toBe(MAX_GUESTS);
  });
});
