import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Screen } from '@/components/screen';
import { SheetHeader } from '@/components/sheet-header';
import { Spacing } from '@/constants/theme';
import { useLanguages } from '@/data/reference';
import { formatDate } from '@/features/inquiry/inquiry-helpers';
import { usePlan } from '@/features/planner/plan';
import {
  clearSearchFilters,
  guestSteps,
  priceSteps,
  setSearchFilters,
  useSearchFilters,
  type SearchSort,
} from '@/features/search/search-filters';
import { useLocale } from '@/i18n/locale-context';
import { localized } from '@/i18n/localized';
import { selectionHaptic } from '@/lib/haptics';

const SORTS: SearchSort[] = ['distance', 'price_low', 'founding'];

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

/**
 * Filters for a results list (docs/RESEARCH_GROWTH.md #4), a sheet:
 * guests (for venues), the most they'd pay to start, a language, and what to
 * show first. `?group=` is the category group, which decides the guest
 * question and the price steps. Changes apply at once; "Show results" closes.
 */
export default function FiltersScreen() {
  const { t } = useLocale();
  const languages = useLanguages();
  const { group } = useLocalSearchParams<{ group?: string }>();
  const filters = useSearchFilters();
  const weddingDate = usePlan().weddingDate;
  const isVenue = group === 'venues';
  const perPlate = group === 'venues' || group === 'food';

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const set = (change: Parameters<typeof setSearchFilters>[0]) => {
    selectionHaptic();
    setSearchFilters(change);
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <SheetHeader title={t('filters.title')} onClose={close} />
      <ScrollView contentContainerStyle={styles.content}>
        {isVenue && (
          <Section title={t('filters.guests')}>
            <Chip
              label={t('filters.any')}
              selected={filters.minGuests === null}
              onPress={() => set({ minGuests: null })}
            />
            {guestSteps(filters.minGuests).map((count) => (
              <Chip
                key={count}
                label={t('filters.guestsStep', { count })}
                selected={filters.minGuests === count}
                onPress={() => set({ minGuests: count })}
              />
            ))}
          </Section>
        )}

        <Section
          title={t('filters.price')}
          hint={perPlate ? t('filters.pricePlateHint') : t('filters.priceEventHint')}
        >
          <Chip
            label={t('filters.any')}
            selected={filters.maxPrice === null}
            onPress={() => set({ maxPrice: null })}
          />
          {priceSteps(group ?? null).map((amount) => (
            <Chip
              key={amount}
              label={t('filters.upTo', { price: usd.format(amount) })}
              selected={filters.maxPrice === amount}
              onPress={() => set({ maxPrice: amount })}
            />
          ))}
        </Section>

        {weddingDate && (
          <Section title={t('filters.date')} hint={t('filters.dateHint')}>
            <Chip
              label={t('filters.anyDate')}
              selected={filters.availableOn === null}
              onPress={() => set({ availableOn: null })}
            />
            <Chip
              label={t('filters.freeOn', { date: formatDate(weddingDate) })}
              selected={filters.availableOn === weddingDate}
              onPress={() => set({ availableOn: weddingDate })}
            />
          </Section>
        )}

        <Section title={t('filters.language')}>
          <Chip
            label={t('filters.any')}
            selected={filters.language === null}
            onPress={() => set({ language: null })}
          />
          {(languages.data ?? []).map(({ code, name }) => (
            <Chip
              key={code}
              label={localized(name)}
              selected={filters.language === code}
              onPress={() => set({ language: code })}
            />
          ))}
        </Section>

        <Section title={t('filters.sort')}>
          {SORTS.map((sort) => (
            <Chip
              key={sort}
              role="radio"
              label={t(`filters.sorts.${sort}`)}
              selected={filters.sort === sort}
              onPress={() => set({ sort })}
            />
          ))}
        </Section>

        <View style={styles.actions}>
          <Button label={t('filters.show')} onPress={close} />
          <Button
            variant="text"
            label={t('filters.clear')}
            onPress={() => {
              selectionHaptic();
              clearSearchFilters();
            }}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <AppText variant="heading" accessibilityRole="header">
        {title}
      </AppText>
      {hint && <AppText color="text2">{hint}</AppText>}
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  section: {
    gap: Spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  actions: {
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
});
