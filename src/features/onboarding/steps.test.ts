import { FIRST_STEP, nextHref, progressFor, stepNumber } from './steps';

describe('the first questions', () => {
  it('starts at the kind of wedding', () => {
    expect(FIRST_STEP).toBe('/onboarding/kind');
  });

  it('counts where the families are from as part of the first question', () => {
    expect(stepNumber('kind')).toBe(1);
    expect(stepNumber('roots')).toBe(1);
    expect(stepNumber('date')).toBe(2);
  });

  it('asks where the families are from only when told to', () => {
    expect(nextHref('kind')).toBe('/onboarding/date');
    expect(nextHref('kind', true)).toBe('/onboarding/roots');
    expect(nextHref('roots')).toBe('/onboarding/date');
    expect(nextHref('date')).toBe('/onboarding/ready');
  });

  it('fills the bar a share per question, picking up where the last one left off', () => {
    expect(progressFor('kind')).toEqual({ from: 0, to: 1 / 3 });
    expect(progressFor('kind', 0.5)).toEqual({ from: 0, to: 1 / 6 });
    expect(progressFor('roots', 1, 0.5)).toEqual({ from: 1 / 6, to: 1 / 3 });
    expect(progressFor('date')).toEqual({ from: 1 / 3, to: 2 / 3 });
  });

  it('never fills the bar while a question is open: the ready plan is the last share', () => {
    expect(progressFor('date').to).toBeLessThan(1);
  });
});
