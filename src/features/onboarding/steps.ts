/**
 * The first questions, in order; each is a screen at /onboarding/{step},
 * starting at FIRST_STEP. Three in the progress bar: the kind of wedding,
 * which events they're having, and the day of each (DECISIONS.md,
 * 2026-11-06), the answers that build the plan and its countdown. "roots"
 * (where the families are from) follows "kind" only when a faith they
 * picked has more than one tradition, and counts as its second half.
 */
export const STEPS = ['kind', 'events', 'days'] as const;

export type Step = (typeof STEPS)[number] | 'roots';

/** Where the first questions start. */
export const FIRST_STEP = '/onboarding/kind' as const;

/** 1-based position, for "1 of 2" and the progress bar. */
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

/**
 * How full the progress bar is, from 0 to 1, as a question opens (`from`)
 * and once it's showing (`to`): each question fills its share, and the
 * first question's first half (`fill` 0.5) leaves room for "Where are the
 * families from?" to fill the rest. Their plan being ready is the last
 * share, so the bar is never full while a question is still open.
 */
export function progressFor(step: Step, fill = 1, fillFrom = 0): { from: number; to: number } {
  const done = stepNumber(step) - 1;
  const shares = STEPS.length + 1;
  return { from: (done + fillFrom) / shares, to: (done + fill) / shares };
}
