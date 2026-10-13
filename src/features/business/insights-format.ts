import type { ChecklistKey, Replies } from '@/data/business-insights';
import { replyTime } from '@/data/business-insights';

type Translate = (key: string, options?: Record<string, string | number>) => string;

/** "This week", "In the last 30 days" or "In the last 3 months". */
export function periodWords(days: 7 | 30 | 90, t: Translate): string {
  return t(`business.insights.period.${days}`);
}

/** The one line at the top: "This week, 38 families saw your page and 4 asked about a date." */
export function headline(
  days: 7 | 30 | 90,
  views: number,
  inquiries: number,
  t: Translate,
): string {
  return t('business.insights.headline', {
    period: periodWords(days, t),
    seen: t('business.insights.seen', { count: views }),
    asked: t('business.insights.askedDate', { count: inquiries }),
  });
}

/**
 * "You replied to 9 of 10 families, usually within 2 hours", or null before
 * anyone has asked.
 */
export function replyLine(replies: Replies, t: Translate): string | null {
  if (replies.leads === 0) return null;
  const replied = t('business.insights.replied', {
    replied: replies.replied,
    leads: replies.leads,
  });
  if (replies.medianMinutes === null) return replied;
  const time = replyTime(replies.medianMinutes);
  return t('business.insights.repliedWithin', {
    replied,
    within: t(`business.insights.within.${time.unit}`, { count: time.count }),
  });
}

/** "June 2027" for "2027-06", with the month in the app's language. */
export function monthLabel(month: string, t: Translate): string {
  const [year, m] = month.split('-').map(Number);
  return `${t(`business.calendar.months.${m}`)} ${year}`;
}

/** Where "Fix it" goes: a My business screen, or the Wedded team (no self-edit yet). */
export function fixTarget(key: ChecklistKey): '/business/calendar' | '/business/menus' | 'team' {
  if (key === 'calendar') return '/business/calendar';
  if (key === 'menus') return '/business/menus';
  return 'team';
}

/** Each value as a share of the biggest, 0 to 1, for bars. */
export function barShares(values: number[]): number[] {
  const most = Math.max(0, ...values);
  return values.map((value) => (most > 0 ? value / most : 0));
}
