import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { groupIcon } from '@/components/group-icon';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import { useVendorSearch } from '@/data/search';
import { photoUrl } from '@/data/vendor-media';
import { useSearchLocation } from '@/features/location/search-location';
import { filtersForGuests, findForPlan } from '@/features/planner/find-for-plan';
import { nextToBook, type NextNeed } from '@/features/planner/plan-helpers';
import type { usePlanView } from '@/features/planner/use-plan-view';
import { NO_FILTERS } from '@/features/search/search-filters';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic, successHaptic } from '@/lib/haptics';
import { Motion } from '@/lib/motion';

import { SectionHeader } from './section-header';

// Enough to swipe through without turning into a to-do list
const SHOWN = 6;
// Counting stops here ("50+ free on your date")
const COUNT_LIMIT = 50;

type PlanView = ReturnType<typeof usePlanView>;

/**
 * Next up: the essentials still to book, soonest event first, as cards you
 * swipe through. Each says how many vendors of that kind are free on the
 * wedding date (or near you, before there's a date) with one of their photos,
 * opens them with See them, and can be ticked off as booked right here.
 */
export function NextUp({ view }: { view: PlanView }) {
  const Colors = useColors();
  const styles = useStyles();
  const { t, locale } = useLocale();
  const { width } = useWindowDimensions();
  const { plan, chosen, needsByEvent, canEdit, toggleBooked } = view;
  const items = nextToBook(plan, chosen, needsByEvent, SHOWN);
  const cardWidth = Math.round(Math.min(300, width * 0.74));

  if (chosen.length === 0) return null;

  return (
    <View style={styles.block}>
      <SectionHeader
        title={t('home.nextUp')}
        link={t('home.seePlan')}
        onLink={() => router.push('/plan')}
      />
      {items.length === 0 ? (
        <View style={styles.allDone}>
          <Icon name="checkmark-circle" size={28} color={Colors.success} />
          <AppText weight={600} style={styles.grow}>
            {t('planner.nothingNext')}
          </AppText>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={cardWidth + Spacing.md}
          decelerationRate="fast"
          style={styles.bleed}
          contentContainerStyle={styles.track}
        >
          {items.map((item) => (
            <Animated.View
              key={`${item.eventSlug}/${item.need.categorySlug}`}
              exiting={Motion.exit}
              layout={Motion.layout}
            >
              <NextUpCard
                item={item}
                width={cardWidth}
                date={plan.weddingDate}
                guestBand={plan.guests?.[item.eventSlug]}
                canEdit={canEdit}
                onBooked={() => {
                  successHaptic();
                  toggleBooked(item.eventSlug, item.need.categorySlug);
                }}
                label={localized(item.need.name, locale)}
              />
            </Animated.View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function NextUpCard({
  item,
  width,
  date,
  guestBand,
  canEdit,
  onBooked,
  label,
}: {
  item: NextNeed;
  width: number;
  date: string | null;
  guestBand: string | undefined;
  canEdit: boolean;
  onBooked: () => void;
  label: string;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const { t, locale } = useLocale();
  const { place, maxMiles } = useSearchLocation();
  const search = useVendorSearch({
    latitude: place?.latitude,
    longitude: place?.longitude,
    maxMiles,
    categorySlug: item.need.categorySlug,
    filters: {
      ...NO_FILTERS,
      ...filtersForGuests(item.need.groupSlug, guestBand),
      availableOn: date,
    },
    limit: COUNT_LIMIT,
  });
  const results = search.data ?? [];
  const cover = results.find((vendor) => vendor.coverPath)?.coverPath ?? null;
  const shown = results.length >= COUNT_LIMIT ? `${COUNT_LIMIT}+` : String(results.length);
  const event = localized(item.eventName, locale);
  const count = search.isPending
    ? ' '
    : results.length === 0
      ? t('home.noneYet')
      : date
        ? t('home.freeOnDateCount', { shown })
        : t('home.nearYouCount', { shown });

  const find = () => {
    selectionHaptic();
    findForPlan(item.need.categorySlug, item.need.groupSlug, item.eventSlug, guestBand);
  };

  return (
    <View style={[styles.card, { width }]}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${event}. ${count}`}
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
              <Icon name={groupIcon(item.need.groupSlug)} size={44} color={Colors.primary} />
            </View>
          )}
          <View style={styles.eventPill}>
            <AppText variant="caption" weight={700} color="onPhoto" numberOfLines={1}>
              {event}
            </AppText>
          </View>
        </View>
        <View style={styles.words}>
          <AppText variant="heading" weight={700} numberOfLines={2}>
            {label}
          </AppText>
          <AppText variant="label" weight={500} color="text2" numberOfLines={1}>
            {count}
          </AppText>
        </View>
      </PressableScale>

      <View style={styles.actions}>
        <PressableScale accessibilityRole="button" onPress={find} style={styles.seeButton}>
          <AppText variant="label" weight={700} color="onPrimary">
            {t('home.seeThem')}
          </AppText>
        </PressableScale>
        {canEdit && (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('home.bookedSpoken', { name: label, event })}
            onPress={onBooked}
            style={styles.bookedButton}
          >
            <Icon name="checkmark" size={18} color={Colors.primary} weight="bold" />
            <AppText variant="label" weight={700} color="primary">
              {t('home.bookedButton')}
            </AppText>
          </PressableScale>
        )}
      </View>
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
  eventPill: {
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
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.lg,
    paddingTop: Spacing.md,
  },
  seeButton: {
    flex: 1,
    minHeight: Sizes.tapTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.button,
    backgroundColor: Colors.primaryFill,
  },
  bookedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    minHeight: Sizes.tapTarget,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.button,
    backgroundColor: Colors.primaryTint,
  },
  allDone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  grow: {
    flex: 1,
  },
}));
