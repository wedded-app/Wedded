import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, RefreshControl, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { LargeTitle, NavBar, useNavScroll, useNavTop } from '@/components/nav';
import { StateView } from '@/components/state-view';
import { useBottomSpace } from '@/components/tab-bar';
import { VendorCard } from '@/components/vendor-card';
import { makeStyles, Sizes, Spacing, useColors } from '@/constants/theme';
import { useCategories, useEvent } from '@/data/reference';
import { useSavedVendors, useSaveVendor } from '@/data/saved';
import { trackSearchAppearances } from '@/data/business-insights';
import { useVendorSearch } from '@/data/search';
import { LocationChip } from '@/features/location/location-chip';
import { FiltersButton } from '@/features/search/filters-button';
import { useSearchFilters } from '@/features/search/search-filters';
import { useSearchLocation } from '@/features/location/search-location';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

const WIDER_MILES = 50;

/**
 * S6 Results: published vendors in a category, nearest first from the search
 * location (without one they still show, founding vendors first). With
 * ?event= a heart saves under that event. Deep link:
 * /c/{category}?event={slug}.
 */
export default function ResultsScreen() {
  const Colors = useColors();
  const styles = useStyles();
  const { category: categorySlug = '', event: eventSlug } = useLocalSearchParams<{
    category: string;
    event?: string;
  }>();
  const { t } = useLocale();
  const router = useRouter();
  const scroll = useNavScroll();
  const top = useNavTop();
  const bottom = useBottomSpace();
  const { place, maxMiles, setMaxMiles } = useSearchLocation();
  const saves = useSavedVendors();
  const { toggleSave } = useSaveVendor();
  const [includeTravelers, setIncludeTravelers] = useState(false);
  const categories = useCategories();
  const event = useEvent(eventSlug ?? '');
  // Guests, price, language and order from the /filters sheet.
  const filters = useSearchFilters();
  const vendors = useVendorSearch({
    latitude: place?.latitude,
    longitude: place?.longitude,
    maxMiles,
    categorySlug,
    // No event filter: plenty of vendors haven't listed every event they
    // serve, and they shouldn't disappear. The event only decides where a
    // heart saves them.
    includeTravelers,
    filters,
    limit: 100,
  });
  const [refreshing, setRefreshing] = useState(false);

  // Each vendor shown counts as a search appearance for their My business
  // numbers (once per vendor per session)
  useEffect(() => {
    if (vendors.data) trackSearchAppearances(vendors.data.map((vendor) => vendor.id));
  }, [vendors.data]);

  // Screen readers don't notice a list that fills in or changes (after
  // "Widen to 50 mi", say), so read out how many vendors there are.
  const resultCount = vendors.isSuccess ? vendors.data.length : null;
  useEffect(() => {
    if (resultCount !== null && resultCount > 0) {
      AccessibilityInfo.announceForAccessibility(t('counts.vendors', { count: resultCount }));
    }
  }, [resultCount, t]);

  // With an event, the heart is for that event; without one, any save counts.
  const savedIds = new Set(
    (saves.data ?? [])
      .filter((save) => eventSlug === undefined || save.eventSlug === eventSlug)
      .map((save) => save.vendorId),
  );

  const category = categories.data?.find((c) => c.slug === categorySlug);
  // While categories load, show no title rather than the raw slug.
  const categoryName = category?.name ?? (categories.isPending ? null : { en: categorySlug });
  const title = categoryName ? localized(categoryName) : null;

  async function onRefresh() {
    setRefreshing(true);
    await vendors.refetch();
    setRefreshing(false);
  }

  const header = (
    <View style={styles.header}>
      {title && (
        <LargeTitle
          scroll={scroll}
          title={title}
          eyebrow={event.data ? t('results.savingTo', { event: localized(event.data.name) }) : null}
        />
      )}
      <LocationChip />
      <FiltersButton groupSlug={category?.groupSlug} />
      {vendors.isSuccess && vendors.data.length > 0 && (
        <AppText variant="label" weight={400} color="text2" style={styles.count}>
          {t('counts.vendors', { count: vendors.data.length })}
        </AppText>
      )}
    </View>
  );

  let empty;
  if (vendors.isPending) {
    empty = <StateView state="loading" />;
  } else if (vendors.isError) {
    empty = <StateView state="error" onRetry={() => void vendors.refetch()} />;
  } else if (place) {
    // Nothing within the distance: offer to look further, or at vendors
    // based further away who still travel here (vision S6 empty states).
    const canWiden = maxMiles !== null && maxMiles < WIDER_MILES;
    empty = (
      <View>
        <StateView
          state="empty"
          icon="location-outline"
          message={
            maxMiles === null
              ? t('results.empty')
              : t('results.emptyNear', { miles: maxMiles, place: place.label })
          }
          action={
            canWiden
              ? {
                  label: t('results.widen', { miles: WIDER_MILES }),
                  onPress: () => setMaxMiles(WIDER_MILES),
                }
              : undefined
          }
        />
        {!includeTravelers && (
          <Button
            variant="text"
            label={t('results.showTravelers')}
            onPress={() => setIncludeTravelers(true)}
          />
        )}
      </View>
    );
  } else {
    empty = <StateView state="empty" icon="people-outline" message={t('results.empty')} />;
  }

  return (
    <View style={styles.screen}>
      <Animated.FlatList
        data={vendors.data ?? []}
        keyExtractor={(vendor) => vendor.id}
        onScroll={scroll.onScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <VendorCard
            name={item.name}
            category={item.category ?? categoryName ?? { en: categorySlug }}
            city={item.city}
            distanceMiles={item.distanceMiles}
            startingPrice={item.startingPrice}
            photoUrl={item.photoUrl}
            foundingNumber={item.foundingNumber}
            isSample={item.isSample}
            travelsToYou={item.withinSearchRadius === false}
            saved={savedIds.has(item.id)}
            onToggleSave={() => toggleSave(item.id, eventSlug)}
            onPress={() =>
              router.push({
                pathname: '/v/[slug]',
                params: eventSlug ? { slug: item.slug, event: eventSlug } : { slug: item.slug },
              })
            }
          />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentContainerStyle={[styles.content, { paddingTop: top, paddingBottom: bottom }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.chevron}
            colors={[Colors.primary]}
          />
        }
      />
      <NavBar scroll={scroll} title={title} />
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  content: {
    gap: Spacing.lg,
    paddingHorizontal: Sizes.pageGutter,
  },
  header: {
    gap: Spacing.md,
  },
  count: {
    paddingHorizontal: Spacing.xs,
  },
}));
