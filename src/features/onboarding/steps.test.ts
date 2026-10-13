import { nextHref, stepNumber } from './steps';

describe('the first questions', () => {
  it('counts where the families are from as part of the second question', () => {
    expect(stepNumber('who')).toBe(1);
    expect(stepNumber('kind')).toBe(2);
    expect(stepNumber('roots')).toBe(2);
    expect(stepNumber('date')).toBe(3);
  });

  it('asks where the families are from only when told to', () => {
    expect(nextHref('who')).toBe('/onboarding/kind');
    expect(nextHref('kind')).toBe('/onboarding/date');
    expect(nextHref('kind', true)).toBe('/onboarding/roots');
    expect(nextHref('roots')).toBe('/onboarding/date');
    expect(nextHref('date')).toBe('/onboarding/ready');
  });
});
