import { useMemo } from 'react';

import { useCategories } from '@/data/reference';
import { useEventNames } from '@/features/business/business-parts';
import { formatDate } from '@/features/inquiry/inquiry-helpers';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

import { budgetWords, timeAgo } from './requests-format';
import type { PostFacts } from './request-parts';

type RequestLike = {
  categorySlug: string;
  eventSlug: string | null;
  eventDate: string | null;
  guestBand: string | null;
  budgetMinCents: number | null;
  budgetMaxCents: number | null;
};

/**
 * Words for a request, the same on every screen: the headline ("Dhol player
 * for the Jaago"), the facts under it, and how long ago it was posted.
 */
export function useRequestWords() {
  const { t, locale } = useLocale();
  const categories = useCategories();
  const eventName = useEventNames();

  return useMemo(() => {
    const byslug = new Map((categories.data ?? []).map((c) => [c.slug, c]));
    const category = (slug: string) => {
      const found = byslug.get(slug);
      return found ? localized(found.name, locale) : slug;
    };
    const group = (slug: string) => byslug.get(slug)?.groupSlug ?? null;
    return {
      category,
      group,
      headline: (r: Pick<RequestLike, 'categorySlug' | 'eventSlug'>) =>
        r.eventSlug
          ? t('requests.headline', {
              category: category(r.categorySlug),
              event: eventName(r.eventSlug),
            })
          : category(r.categorySlug),
      facts: (r: RequestLike, miles?: number | null): PostFacts => ({
        date: r.eventDate ? formatDate(r.eventDate) : null,
        guests:
          r.guestBand && r.guestBand !== 'not_sure' ? t(`inquiry.guestBands.${r.guestBand}`) : null,
        budget: budgetWords(r.budgetMinCents, r.budgetMaxCents, t, group(r.categorySlug)),
        distance:
          miles == null
            ? null
            : miles < 1
              ? t('requests.nearby')
              : t('requests.miles', { count: Math.round(miles) }),
      }),
      ago: (iso: string) => timeAgo(iso, t),
    };
  }, [categories.data, eventName, locale, t]);
}
