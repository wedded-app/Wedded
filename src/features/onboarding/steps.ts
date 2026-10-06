/**
 * The first questions, in order; each is a screen at /onboarding/{step},
 * starting at /onboarding/who. Three, one tap each (docs/DECISIONS.md,
 * 2026-10-02): everything else is asked later, where it matters.
 */
export const STEPS = ['who', 'kind', 'date'] as const;

export type Step = (typeof STEPS)[number];

/** 1-based position, for "2 of 3" and the progress bar. */
export function stepNumber(step: Step): number {
  return STEPS.indexOf(step) + 1;
}

/** The screen after this one: the next question, or the plan once it's ready. */
export function nextHref(step: Step): `/onboarding/${Step}` | '/onboarding/ready' {
  const next = STEPS[STEPS.indexOf(step) + 1];
  return next ? `/onboarding/${next}` : '/onboarding/ready';
}
