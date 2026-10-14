/**
 * Pure helpers for Requests and Families looking (#217): budget ranges,
 * short times ("2h") and initials. No React, so they're tested on their own.
 */

type Translate = (key: string, options?: Record<string, string | number>) => string;

/** A budget a family can pick, in whole dollars; null means no end. */
export type BudgetBand = { key: string; min: number | null; max: number | null };

/**
 * The budget choices for a vendor type. Venues and caterers price per
 * guest, so their ranges are per person; everyone else's are for the event.
 */
export function budgetBands(groupSlug: string | null): BudgetBand[] {
  if (groupSlug === 'venues' || groupSlug === 'food') {
    return [
      { key: 'pp_under_25', min: null, max: 25 },
      { key: 'pp_25_50', min: 25, max: 50 },
      { key: 'pp_50_80', min: 50, max: 80 },
      { key: 'pp_80_plus', min: 80, max: null },
    ];
  }
  return [
    { key: 'under_500', min: null, max: 500 },
    { key: '500_1000', min: 500, max: 1000 },
    { key: '1000_2500', min: 1000, max: 2500 },
    { key: '2500_5000', min: 2500, max: 5000 },
    { key: '5000_plus', min: 5000, max: null },
  ];
}

/** True when budgets for this vendor type are per guest. */
export const perGuest = (groupSlug: string | null) =>
  groupSlug === 'venues' || groupSlug === 'food';

const dollars = (cents: number) =>
  (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });

/**
 * "$500–1,000", "Up to $500", "$5,000+", with "a guest" for per-guest types,
 * or null when there's no budget.
 */
export function budgetWords(
  minCents: number | null,
  maxCents: number | null,
  t: Translate,
  groupSlug: string | null = null,
): string | null {
  let words: string;
  if (minCents != null && maxCents != null) {
    words = `${dollars(minCents)}–${dollars(maxCents).replace('$', '')}`;
  } else if (maxCents != null) {
    words = t('requests.budget.upTo', { amount: dollars(maxCents) });
  } else if (minCents != null) {
    words = `${dollars(minCents)}+`;
  } else {
    return null;
  }
  return perGuest(groupSlug) ? t('requests.budget.perGuest', { budget: words }) : words;
}

/** "now", "5m", "2h", "3d", "2w", then the date: how long ago, as Threads says it. */
export function timeAgo(iso: string, t: Translate, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return t('requests.ago.now');
  if (minutes < 60) return t('requests.ago.minutes', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('requests.ago.hours', { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t('requests.ago.days', { count: days });
  if (days < 30) return t('requests.ago.weeks', { count: Math.floor(days / 7) });
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(iso));
}

/** "HK" for "Harjit K.", "R" for "Raj": the letters in a family's avatar. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** "Harjit K." from "Harjit Kaur Sandhu": how vendors see a family's name. */
export function shortName(fullName: string | null | undefined): string {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]?.toUpperCase()}.`;
}
