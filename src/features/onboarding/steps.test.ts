import { FIRST_STEP, nextHref, progressFor, stepNumber } from './steps';

describe('the first questions', () => {
  it('starts at the kind of wedding', () => {
    expect(FIRST_STEP).toBe('/onboarding/kind');
  });

  it('counts where the families are from as part of the first question', () => {
    expect(stepNumber('kind')).toBe(1);
    expect(stepNumber('roots')).toBe(1);
    expect(stepNumber('events')).toBe(2);
    expect(stepNumber('days')).toBe(3);
    expect(stepNumber('guests')).toBe(5);
  });

  it('asks where the families are from only when told to', () => {
    expect(nextHref('kind')).toBe('/onboarding/events');
    expect(nextHref('kind', true)).toBe('/onboarding/roots');
    expect(nextHref('roots')).toBe('/onboarding/events');
    expect(nextHref('events')).toBe('/onboarding/days');
    expect(nextHref('days')).toBe('/onboarding/where');
    expect(nextHref('where')).toBe('/onboarding/guests');
    expect(nextHref('guests')).toBe('/onboarding/ready');
  });

  it('fills the bar a share per question, picking up where the last one left off', () => {
    expect(progressFor('kind')).toEqual({ from: 0, to: 1 / 6 });
    expect(progressFor('kind', 0.5)).toEqual({ from: 0, to: 1 / 12 });
    expect(progressFor('roots', 1, 0.5)).toEqual({ from: 1 / 12, to: 1 / 6 });
    expect(progressFor('events')).toEqual({ from: 1 / 6, to: 2 / 6 });
    expect(progressFor('guests')).toEqual({ from: 4 / 6, to: 5 / 6 });
  });

  it('never fills the bar while a question is open: the ready plan is the last share', () => {
    expect(progressFor('guests').to).toBeLessThan(1);
  });
});
