import { router } from 'expo-router';

import { Button } from '@/components/button';
import { activeFilterCount, useSearchFilters } from '@/features/search/search-filters';
import { useLocale } from '@/i18n/locale-context';

/**
 * "Filters" (with how many are on) for a results list: opens the /filters
 * sheet. Pass the category's group so the sheet asks the right questions.
 * Give the list `useSearchFilters()` as `filters` for useVendorSearch().
 */
export function FiltersButton({ groupSlug }: { groupSlug?: string | null }) {
  const { t } = useLocale();
  const count = activeFilterCount(useSearchFilters());
  return (
    <Button
      variant="text"
      icon="options-outline"
      label={count > 0 ? t('filters.buttonCount', { count }) : t('filters.button')}
      onPress={() =>
        router.push({ pathname: '/filters', params: groupSlug ? { group: groupSlug } : {} })
      }
    />
  );
}
