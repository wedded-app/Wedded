import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { groupIcon } from '@/components/group-icon';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { priceWords } from '@/components/vendor-card';
import { makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import { useAllEventNeeds, useHomeEvents } from '@/data/reference';
import { useVendorSearch } from '@/data/search';
import { photoUrl } from '@/data/vendor-media';
import { useSession } from '@/features/auth/session';
import { useSearchLocation } from '@/features/location/search-location';
import { useStartPlanning } from '@/features/onboarding/start';
import { filtersForGuests } from '@/features/planner/find-for-plan';
import { clearSearchFilters, NO_FILTERS, setSearchFilters } from '@/features/search/search-filters';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';
import { Motion } from '@/lib/motion';

import { bookFirstNeeds, cheapestPrice, shortDate, type FirstNeed } from './book-first';
import { SectionHeader } from './section-header';
import { useWeddingDraft } from './wedding-draft';

const SHOWN = 5;
// Counting stops here ("50+ near you")
const COUNT_LIMIT = 50;

/**
 * Book these first, on Home before there's a plan: the kinds of vendor to
 * start with (the venue, then what the main events need most; bookFirstNeeds),
 * as cards to swipe through, each with a vendor's photo, how many there are
 * and the lowest starting price. They sharpen as the wedding card's
 * questions are answered: near where it is, halls that seat everyone, and
 * with a date, how many aren't booked that day. Until there's a date each
 * card offers to add it. A card opens those vendors with the same filters.
 */
export function BookFirst() {
  const styles = useStyles();
  const { t } = useLocale();
  const { width } = useWindowDimensions();
  const sections = useHomeEvents();
  const needs = useAllEventNeeds();
  const items = sections.data && needs.data ? bookFirstNeeds(sections.data, needs.data, SHOWN) : [];
  const cardWidth = Math.round(Math.min(300, width * 0.74));

  if (items.length === 0) return null;

  return (
    <View style={styles.block}>
      <SectionHeader
        title={t('home.bookFirst.title')}
        link={t('home.seeAllTypes')}
        onLink={() => router.navigate('/search')}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + Spacing.md}
        decelerationRate="fast"
        style={styles.bleed}
        contentContainerStyle={styles.track}
      >
        {items.map((need, index) => (
          <Animated.View key={need.categorySlug} entering={Motion.stagger(index)}>
            <BookFirstCard need={need} width={cardWidth} />
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}

function BookFirstCard({ need, width }: { need: FirstNeed; width: number }) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const { status } = useSession();
  const startPlanning = useStartPlanning();
  const { date, guestBand } = useWeddingDraft();
  const { place, maxMiles } = useSearchLocation();
  const filters = { ...filtersForGuests(need.groupSlug, guestBand), availableOn: date };
  const search = useVendorSearch({
    latitude: place?.latitude,
    longitude: place?.longitude,
    maxMiles: place ? maxMiles : null,
    categorySlug: need.categorySlug,
    filters: { ...NO_FILTERS, ...filters },
    limit: COUNT_LIMIT,
  });
  const results = search.data ?? [];
  const cover = results.find((vendor) => vendor.coverPath)?.coverPath ?? null;
  const shown = results.length >= COUNT_LIMIT ? `${COUNT_LIMIT}+` : String(results.length);
  const label = localized(need.name);
  const price = priceWords(cheapestPrice(results), t);
  const count = search.isPending
    ? ' '
    : results.length === 0
      ? t('home.noneYet')
      : date
        ? t('home.bookFirst.notBooked', { shown, date: shortDate(date) })
        : place
          ? t('home.nearYouCount', { shown })
          : t('home.bookFirst.toChoose', { shown });

  const find = () => {
    selectionHaptic();
    clearSearchFilters();
    setSearchFilters(filters);
    router.push({ pathname: '/c/[category]', params: { category: need.categorySlug } });
  };
  const addDate = () => {
    selectionHaptic();
    if (status === 'signedIn') startPlanning();
    else router.push('/when');
  };

  return (
    <View style={[styles.card, { width }]}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={[label, count, price?.spoken].filter(Boolean).join('. ')}
        onPress={find}
        pressedScale={0.98}
      >
        <View style={styles.photo}>
          {cover ? (
            <Image
              source={{ uri: photoUrl(cover, 'medium') }}
              contentFit="cover"
              transition={250}
              style={styles.fill}
            />
          ) : (
            <View style={[styles.fill, styles.noPhoto]}>
              <Icon name={groupIcon(need.groupSlug)} size={44} color={Colors.primary} />
            </View>
          )}
          <View style={styles.pill}>
            <AppText variant="caption" weight={700} color="onPhoto" numberOfLines={1}>
              {t('home.bookFirst.forEvents', { count: need.events })}
            </AppText>
          </View>
        </View>
        <View style={styles.words}>
          <AppText variant="heading" weight={700} numberOfLines={1}>
            {label}
          </AppText>
          <AppText variant="label" weight={500} color="text2" numberOfLines={1}>
            {count}
          </AppText>
          {price && (
            <AppText variant="label" weight={600} numberOfLines={1}>
              {price.shown}
            </AppText>
          )}
        </View>
      </PressableScale>

      {date ? (
        <PressableScale accessibilityRole="button" onPress={find} style={styles.see}>
          <AppText variant="label" weight={700} color="onPrimary">
            {t('home.seeThem')}
          </AppText>
        </PressableScale>
      ) : (
        <PressableScale accessibilityRole="button" onPress={addDate} style={styles.addDate}>
          <Icon name="calendar-outline" size={18} color={Colors.primary} weight="semibold" />
          <AppText variant="label" weight={700} color="primary" style={styles.grow}>
            {t('home.bookFirst.addDate')}
          </AppText>
          <Icon name="chevron-forward" size={16} color={Colors.primary} weight="semibold" />
        </PressableScale>
      )}
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  block: {
    gap: Spacing.md,
  },
  // The cards run to the screen edges while the first one lines up with the page
  bleed: {
    marginHorizontal: -Sizes.pageGutter,
  },
  track: {
    gap: Spacing.md,
    paddingHorizontal: Sizes.pageGutter,
  },
  card: {
    overflow: 'hidden',
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  photo: {
    height: 150,
    backgroundColor: Colors.surface2,
  },
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  noPhoto: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryTint,
  },
  pill: {
    position: 'absolute',
    left: Spacing.md,
    bottom: Spacing.md,
    maxWidth: '80%',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.chip,
    backgroundColor: Colors.photoScrim,
  },
  words: {
    gap: 2,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  see: {
    minHeight: Sizes.tapTarget,
    alignItems: 'center',
    justifyContent: 'center',
    margin: Spacing.lg,
    marginTop: Spacing.md,
    borderRadius: Radius.button,
    backgroundColor: Colors.primaryFill,
  },
  addDate: {
    minHeight: Sizes.tapTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    margin: Spacing.lg,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.button,
    backgroundColor: Colors.primaryTint,
  },
  grow: {
    flex: 1,
  },
}));
