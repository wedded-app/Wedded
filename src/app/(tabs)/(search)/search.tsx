import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import { useFontScale } from '@/components/app-text';
import { CategoryRow } from '@/components/category-row';
import { CategoryTile } from '@/components/category-tile';
import { Chip } from '@/components/chip';
import { groupIcon } from '@/components/group-icon';
import { ListSection, SectionTitle } from '@/components/list';
import { NavScreen } from '@/components/nav';
import { SearchField } from '@/components/search-field';
import { StateView } from '@/components/state-view';
import { VendorCard } from '@/components/vendor-card';
import { Spacing } from '@/constants/theme';
import { useCategories } from '@/data/reference';
import { useSavedVendors, useSaveVendor } from '@/data/saved';
import { trackSearchAppearances } from '@/data/business-insights';
import { useVendorSearch } from '@/data/search';
import { useCategoryVendorCounts } from '@/data/vendors';
import { useSearchLocation } from '@/features/location/search-location';
import { matchCategories } from '@/features/search/match-categories';
import { PlanCard, usePlanFromQuery } from '@/features/search/plan-card';
import { useDebouncedValue, vendorQuery } from '@/features/search/vendor-query';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

// "Popular" is the categories with the most published vendors, so it comes
// from the data rather than a list in the app.
const POPULAR_COUNT = 8;
// Enough to find a vendor by name; a category's full list is one tap away.
const VENDOR_LIMIT = 10;

/**
 * S8 Search: type to match vendor types by English or Punjabi name and their
 * aliases (on the device), and vendors by name, tagline or type (from the
 * database, nearest first, at any distance so a vendor someone was told about
 * always turns up). Or pick from Popular or the A to Z grid.
 * Opened from Home's search box with ?focus=1, the keyboard comes up.
 * Typing a wedding ("punjabi wedding in yuba city for 300") puts "Plan this
 * wedding" on top, which opens the first questions already filled in.
 */
export default function SearchScreen() {
  const { t, locale } = useLocale();
  const router = useRouter();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const inputRef = useRef<TextInput>(null);
  const [query, setQuery] = useState('');
  const categories = useCategories();
  const counts = useCategoryVendorCounts();
  const { place } = useSearchLocation();
  const saves = useSavedVendors();
  const { toggleSave } = useSaveVendor();
  const typed = vendorQuery(query);
  const needle = useDebouncedValue(typed);
  const vendors = useVendorSearch(
    {
      latitude: place?.latitude,
      longitude: place?.longitude,
      maxMiles: null,
      query: needle ?? undefined,
      limit: VENDOR_LIMIT,
    },
    { enabled: needle !== null, keepPrevious: true },
  );
  // Each vendor shown counts as a search appearance for their My business
  // numbers (once per vendor per session)
  useEffect(() => {
    if (vendors.data && needle !== null) {
      trackSearchAppearances(vendors.data.map((vendor) => vendor.id));
    }
  }, [vendors.data, needle]);
  // Two columns stop fitting once the phone's text is very large.
  const columns = useFontScale('heading') >= 1.5 ? 1 : 2;

  useFocusEffect(
    useCallback(() => {
      if (focus) {
        inputRef.current?.focus();
        router.setParams({ focus: undefined });
      }
    }, [focus, router]),
  );

  const openCategory = (slug: string) =>
    router.push({ pathname: '/c/[category]', params: { category: slug } });

  const all = categories.data ?? [];
  const vendorCount = (slug: string) => counts.data?.[slug] ?? 0;
  const matches = matchCategories(all, query);
  const planHint = usePlanFromQuery(query);
  const savedIds = new Set((saves.data ?? []).map((save) => save.vendorId));
  // Still typing or still fetching: don't say "nothing matches" yet.
  const vendorsSettling = typed !== null && (needle !== typed || vendors.isFetching);
  const foundVendors = typed !== null && needle !== null ? (vendors.data ?? []) : [];
  const popular = [...all]
    .filter((category) => vendorCount(category.slug) > 0)
    .sort((a, b) => vendorCount(b.slug) - vendorCount(a.slug))
    .slice(0, POPULAR_COUNT);

  let body;
  if (categories.isPending) {
    body = <StateView state="loading" />;
  } else if (categories.isError) {
    body = <StateView state="error" onRetry={() => void categories.refetch()} />;
  } else if (query.trim()) {
    body =
      matches.length === 0 && foundVendors.length === 0 && !planHint ? (
        vendorsSettling ? (
          <StateView state="loading" />
        ) : vendors.isError ? (
          <StateView state="error" onRetry={() => void vendors.refetch()} />
        ) : (
          <StateView
            state="empty"
            icon="search-outline"
            message={t('search.noMatch', { query: query.trim() })}
          />
        )
      ) : (
        <>
          {planHint && <PlanCard hint={planHint} />}
          {matches.length > 0 && (
            <View style={styles.block}>
              <SectionTitle>{t('search.types')}</SectionTitle>
              <ListSection inset>
                {matches.map((category) => (
                  <CategoryRow
                    key={category.slug}
                    name={category.name}
                    icon={groupIcon(category.groupSlug)}
                    onPress={() => openCategory(category.slug)}
                  />
                ))}
              </ListSection>
            </View>
          )}
          {foundVendors.length > 0 && (
            <View style={styles.block}>
              <SectionTitle>{t('search.vendors')}</SectionTitle>
              <View style={styles.list}>
                {foundVendors.map((vendor) => (
                  <VendorCard
                    key={vendor.id}
                    name={vendor.name}
                    category={vendor.category ?? { en: '' }}
                    city={vendor.city}
                    distanceMiles={vendor.distanceMiles}
                    startingPrice={vendor.startingPrice}
                    photoUrl={vendor.photoUrl}
                    foundingNumber={vendor.foundingNumber}
                    saved={savedIds.has(vendor.id)}
                    onToggleSave={() => toggleSave(vendor.id)}
                    onPress={() =>
                      router.push({ pathname: '/v/[slug]', params: { slug: vendor.slug } })
                    }
                  />
                ))}
              </View>
            </View>
          )}
        </>
      );
  } else {
    const rows = [];
    for (let i = 0; i < all.length; i += columns) {
      rows.push(all.slice(i, i + columns));
    }
    body = (
      <>
        {popular.length > 0 && (
          <View style={styles.block}>
            <SectionTitle>{t('search.popular')}</SectionTitle>
            <View style={styles.chips}>
              {popular.map((category) => (
                <Chip
                  key={category.slug}
                  role="button"
                  label={localized(category.name, locale)}
                  onPress={() => openCategory(category.slug)}
                />
              ))}
            </View>
          </View>
        )}
        <View style={styles.block}>
          <SectionTitle>{t('search.allCategories')}</SectionTitle>
          <View style={styles.grid}>
            {rows.map((row) => (
              <View key={row[0].slug} style={styles.gridRow}>
                {row.map((category) => (
                  <CategoryTile
                    key={category.slug}
                    name={category.name}
                    icon={groupIcon(category.groupSlug)}
                    vendorCount={vendorCount(category.slug) || undefined}
                    nearYou={false}
                    onPress={() => openCategory(category.slug)}
                    style={styles.tile}
                  />
                ))}
                {row.length < columns && <View style={styles.tile} />}
              </View>
            ))}
          </View>
        </View>
      </>
    );
  }

  return (
    <NavScreen title={t('tabs.search')} back={false} keyboardDismissMode="on-drag">
      <SearchField ref={inputRef} value={query} onChangeText={setQuery} />
      {body}
    </NavScreen>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: Spacing.lg,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  list: {
    gap: Spacing.lg,
  },
  grid: {
    gap: Spacing.md,
  },
  gridRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  tile: {
    flex: 1,
  },
});
