import { router } from 'expo-router';

import type { NeedsByEvent } from '@/data/reference';
import { filtersForGuests } from '@/features/planner/find-for-plan';
import { clearSearchFilters, setSearchFilters } from '@/features/search/search-filters';
import { VendorShelf } from '@/features/search/vendor-shelf';
import { isVenue, shelfKinds } from '@/features/search/vendors-tab';
import { useLocale } from '@/i18n/locale-context';

/**
 * One small shelf of vendors on Home before a plan is saved (Fezy,
 * 2026-11-10: one shelf instead of the chips and the giant hall card): the
 * hall, since it sets the date, as small photo cards with the words under
 * each, like the Vendors tab. Only halls near them, free on the main day and
 * seating the guests when a plan on the phone says so. See all opens the
 * hall's results with the same filters. Hidden when no hall fits.
 */
export function HallShelf({
  events,
  needsByEvent,
  date,
  guestBand,
}: {
  /** The events whose needs count (event slugs). */
  events: string[];
  needsByEvent: NeedsByEvent;
  date: string | null;
  guestBand: string | null;
}) {
  const { t } = useLocale();
  const hall = shelfKinds(events, needsByEvent, {}, 4).find(isVenue);
  if (!hall) return null;

  return (
    <VendorShelf
      kind={hall}
      title={t('vendorsTab.hallFirst')}
      subtitle={t('vendorsTab.hallFirstBody')}
      date={date}
      guestBand={guestBand}
      onSeeAll={() => {
        clearSearchFilters();
        setSearchFilters({ ...filtersForGuests(hall.groupSlug, guestBand), availableOn: date });
        router.push({ pathname: '/c/[category]', params: { category: hall.categorySlug } });
      }}
    />
  );
}
