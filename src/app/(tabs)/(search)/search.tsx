import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type TextInputInstance } from 'react-native';

import { CategoryRow } from '@/components/category-row';
import { Chip } from '@/components/chip';
import { groupIcon } from '@/components/group-icon';
import { ListRow, ListSection, SectionTitle } from '@/components/list';
import { NavScreen } from '@/components/nav';
import { SearchField } from '@/components/search-field';
import { StateView } from '@/components/state-view';
import { VendorCard } from '@/components/vendor-card';
import { Spacing } from '@/constants/theme';
import { useCategories, useCategoryGroups } from '@/data/reference';
import { useSavedVendors, useSaveVendor } from '@/data/saved';
import { trackSearchAppearances } from '@/data/business-insights';
import { useVendorSearch } from '@/data/search';
import { useCategoryVendorCounts } from '@/data/vendors';
import { useSearchLocation } from '@/features/location/search-location';
import { matchCategories } from '@/features/search/match-categories';
import { PlanCard, usePlanFromQuery } from '@/features/search/plan-card';
import { useDebouncedValue, vendorQuery } from '@/features/search/vendor-query';
import { AskWedButton } from '@/features/wed/ask-wed-button';
import { openWed } from '@/features/wed/open-wed';
import type { WedContext } from '@/features/wed/wed-store';
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
  const { t } = useLocale();
  const router = useRouter();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const inputRef = useRef<TextInputInstance>(null);
  const [query, setQuery] = useState('');
  const categories = useCategories();
  const groups = useCategoryGroups();
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
  // Wed (mockup): look past Wedded for what they typed, on the web and Instagram.
  const asked = query.trim();
  const aboutSearch: WedContext = { kind: 'query', label: `“${asked}” in Search` };
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
            message={t('search.noMatch', { query: asked })}
            action={{
              label: `Ask Wed to look for “${asked}”`,
              onPress: () =>
                openWed({
                  about: aboutSearch,
                  ask: `Look for ${asked} near Yuba City, including Instagram pages`,
                }),
            }}
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
                    isSample={vendor.isSample}
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
          {!vendorsSettling && (
            <ListSection>
              <View style={styles.wedRow}>
                <AskWedButton
                  variant="row"
                  label="Not finding it? Ask Wed to look on the web"
                  about={aboutSearch}
                  ask={`Look on the web for ${asked} near Yuba City`}
                />
              </View>
            </ListSection>
          )}
        </>
      );
  } else {
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
                  label={localized(category.name)}
                  onPress={() => openCategory(category.slug)}
                />
              ))}
            </View>
          </View>
        )}
        {/* A short list of kinds, each opening its types, instead of every type at once */}
        {groups.data && (
          <View style={styles.block}>
            <SectionTitle>{t('search.browseByKind')}</SectionTitle>
            <ListSection>
              {groups.data.map((group) => (
                <ListRow
                  key={group.slug}
                  icon={groupIcon(group.slug)}
                  title={localized(group.name)}
                  onPress={() =>
                    router.push({ pathname: '/g/[group]', params: { group: group.slug } })
                  }
                />
              ))}
            </ListSection>
          </View>
        )}
      </>
    );
  }

  return (
    <NavScreen title={t('tabs.search')} keyboardDismissMode="on-drag">
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
  wedRow: {
    paddingHorizontal: Spacing.lg,
  },
});
