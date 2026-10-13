/**
 * The first questions, in order; each is a screen at /onboarding/{step},
 * starting at /onboarding/who. Three in the progress bar, one tap each
 * (docs/DECISIONS.md, 2026-10-07): everything else is asked later, where it
 * matters. "roots" (where the families are from) follows "kind" only when a
 * faith they picked has more than one tradition, and counts as its second
 * half: still 3 questions.
 */
export const STEPS = ['who', 'kind', 'date'] as const;

export type Step = (typeof STEPS)[number] | 'roots';

/** 1-based position, for "2 of 3" and the progress bar. */
export function stepNumber(step: Step): number {
  return STEPS.indexOf(step === 'roots' ? 'kind' : step) + 1;
}

/** The screen after this one: the next question, or the plan once it's ready. */
export function nextHref(
  step: Step,
  askRoots = false,
): `/onboarding/${Step}` | '/onboarding/ready' {
  if (step === 'kind' && askRoots) return '/onboarding/roots';
  const next = STEPS[stepNumber(step)];
  return next ? `/onboarding/${next}` : '/onboarding/ready';
}
