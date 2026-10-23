import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  FadeIn,
  SlideOutLeft,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Line } from 'react-native-svg';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { makeStyles, Radius, Spacing, Timing, useColors } from '@/constants/theme';
import { useVendorSearch } from '@/data/search';
import { useSearchLocation } from '@/features/location/search-location';
import { filtersForGuests, findForPlan } from '@/features/planner/find-for-plan';
import { nextToBook, type NextNeed } from '@/features/planner/plan-helpers';
import type { usePlanView } from '@/features/planner/use-plan-view';
import { NO_FILTERS } from '@/features/search/search-filters';
import { WedMark } from '@/features/wed/wed-mark';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic, successHaptic } from '@/lib/haptics';
import { iosEasing } from '@/lib/motion';

import { stubParts } from './greeting';
import { SectionHeader } from './section-header';

// The ticket on top, and the two tucked behind it
const SHOWN = 3;
// How far each ticket behind peeks out under the one in front
const PEEK = 10;
const STUB = 78;
const NOTCH = 20;
// Counting stops here ("50+ free")
const COUNT_LIMIT = 50;
const UNDO_MS = 6000;

type PlanView = ReturnType<typeof usePlanView>;

/**
 * Up next: the essentials still to book, soonest event first, as a stack of
 * tickets (the final look, 2026-10-23). One step at a time: the top ticket
 * says what to book for which event and how many are free that day, with
 * See them and Done (booked). Done slides it away to the left, the next one
 * moves up, and Undo stays for a few seconds. With nothing left: All caught up.
 */
export function NextUp({ view }: { view: PlanView }) {
  const styles = useStyles();
  const { t } = useLocale();
  const { plan, chosen, needsByEvent, canEdit, toggleBooked } = view;
  const items = nextToBook(plan, chosen, needsByEvent, SHOWN + 1);
  const [height, setHeight] = useState(0);
  const [undo, setUndo] = useState<{ event: string; category: string; name: string } | null>(null);

  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [undo]);

  if (chosen.length === 0) return null;

  const done = (item: NextNeed) => {
    successHaptic();
    toggleBooked(item.eventSlug, item.need.categorySlug);
    setUndo({
      event: item.eventSlug,
      category: item.need.categorySlug,
      name: localized(item.need.name),
    });
  };

  return (
    <View style={styles.block}>
      <SectionHeader
        title={t('home.nextUp')}
        link={t('home.seePlan')}
        onLink={() => router.navigate('/plan')}
      />
      <View style={[styles.stack, { minHeight: (height || 168) + PEEK * 2 }]}>
        {items.length === 0 ? (
          <Animated.View entering={FadeIn.duration(200)} style={styles.caught}>
            <WedMark size={36} color="ombre" />
            <AppText variant="heading" weight={600}>
              {t('home.upNext.caughtUp')}
            </AppText>
            <AppText variant="label" color="text2" style={styles.center}>
              {t('planner.nothingNext')}
            </AppText>
          </Animated.View>
        ) : (
          items
            .slice(0, SHOWN)
            .map((item, depth) => (
              <Ticket
                key={`${item.eventSlug}/${item.need.categorySlug}`}
                item={item}
                depth={depth}
                date={plan.eventDates?.[item.eventSlug] ?? plan.weddingDate}
                weddingDate={plan.weddingDate}
                guestBand={plan.guests?.[item.eventSlug]}
                canEdit={canEdit}
                onDone={() => done(item)}
                onHeight={depth === 0 ? setHeight : undefined}
                height={depth === 0 ? undefined : height || 168}
              />
            ))
            .reverse()
        )}
      </View>
      {undo && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.undoRow}>
          <AppText variant="label" weight={500} style={styles.grow} numberOfLines={1}>
            {t('home.upNext.marked', { name: undo.name })}
          </AppText>
          <PressableScale
            accessibilityRole="button"
            onPress={() => {
              selectionHaptic();
              toggleBooked(undo.event, undo.category);
              setUndo(null);
            }}
            style={styles.undoButton}
          >
            <AppText variant="label" weight={700} color="primary">
              {t('home.upNext.undo')}
            </AppText>
          </PressableScale>
        </Animated.View>
      )}
    </View>
  );
}

function Ticket({
  item,
  depth,
  date,
  weddingDate,
  guestBand,
  canEdit,
  onDone,
  onHeight,
  height,
}: {
  item: NextNeed;
  depth: number;
  date: string | null;
  weddingDate: string | null;
  guestBand: string | undefined;
  canEdit: boolean;
  onDone: () => void;
  onHeight?: (height: number) => void;
  /** Tickets behind the top one take its height. */
  height?: number;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const reduceMotion = useReducedMotion();
  const { place, maxMiles } = useSearchLocation();
  const search = useVendorSearch({
    latitude: place?.latitude,
    longitude: place?.longitude,
    maxMiles,
    categorySlug: item.need.categorySlug,
    filters: {
      ...NO_FILTERS,
      ...filtersForGuests(item.need.groupSlug, guestBand),
      availableOn: weddingDate,
    },
    limit: COUNT_LIMIT,
  });
  const count = search.data?.length ?? 0;
  const shown = count >= COUNT_LIMIT ? `${COUNT_LIMIT}+` : String(count);
  const label = localized(item.need.name);
  const event = localized(item.eventName);
  const stub = stubParts(date);
  const seeLabel =
    search.isPending || count === 0
      ? t('home.seeThem')
      : weddingDate
        ? t('home.upNext.seeFree', { shown })
        : t('home.upNext.seeNear', { shown });

  // Each ticket glides to its place in the stack as the one in front leaves
  const place2 = useSharedValue(depth);
  useEffect(() => {
    place2.value = reduceMotion
      ? depth
      : withTiming(depth, { duration: Timing.quick, easing: iosEasing });
  }, [depth, reduceMotion, place2]);
  const placed = useAnimatedStyle(() => ({
    transform: [{ translateY: place2.value * PEEK }, { scale: 1 - place2.value * 0.05 }],
  }));
  const words = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - place2.value) }));

  const find = () => {
    selectionHaptic();
    findForPlan(item.need.categorySlug, item.need.groupSlug, item.eventSlug, guestBand);
  };

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={SlideOutLeft.duration(Timing.quick).easing(iosEasing)}
      onLayout={
        onHeight ? (e: LayoutChangeEvent) => onHeight(e.nativeEvent.layout.height) : undefined
      }
      style={[
        styles.ticket,
        { zIndex: SHOWN - depth, backgroundColor: depth === 0 ? Colors.surface : Colors.surface2 },
        height !== undefined && { height },
        placed,
      ]}
      pointerEvents={depth === 0 ? 'auto' : 'none'}
      accessibilityElementsHidden={depth > 0}
      importantForAccessibility={depth > 0 ? 'no-hide-descendants' : 'auto'}
    >
      <Animated.View style={[styles.stub, words]}>
        {stub ? (
          <>
            <AppText variant="caption" weight={600} color="primary" style={styles.caps}>
              {stub.month}
            </AppText>
            <AppText weight={700} style={styles.day} maxFontSizeMultiplier={1.3}>
              {stub.day}
            </AppText>
            <AppText variant="caption" weight={600} color="text2" style={styles.caps}>
              {stub.weekday}
            </AppText>
          </>
        ) : (
          <WedMark size={28} color="ombre" />
        )}
      </Animated.View>
      <Svg width={2} height="100%" style={styles.perforation}>
        <Line
          x1={1}
          y1={10}
          x2={1}
          y2="100%"
          stroke={Colors.separator}
          strokeWidth={2}
          strokeDasharray="5 5"
        />
      </Svg>
      <Animated.View style={[styles.body, words]}>
        <AppText variant="caption" weight={600} color="text2" style={styles.caps}>
          {event.toUpperCase()}
        </AppText>
        <AppText variant="heading" weight={600} numberOfLines={2}>
          {label}
        </AppText>
        <View style={styles.actions}>
          <PressableScale accessibilityRole="button" onPress={find} style={styles.see}>
            <AppText variant="label" weight={600} color="onPrimary" numberOfLines={1}>
              {seeLabel}
            </AppText>
          </PressableScale>
          {canEdit && (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t('home.bookedSpoken', { name: label, event })}
              onPress={onDone}
              style={styles.done}
            >
              <Icon name="checkmark" size={16} color={Colors.text} weight="bold" />
              <AppText variant="label" weight={600}>
                {t('home.upNext.done')}
              </AppText>
            </PressableScale>
          )}
        </View>
      </Animated.View>
      <View style={[styles.notch, styles.notchTop]} />
      <View style={[styles.notch, styles.notchBottom]} />
    </Animated.View>
  );
}

const useStyles = makeStyles((Colors) => ({
  block: {
    gap: Spacing.md,
  },
  stack: {},
  ticket: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    flexDirection: 'row',
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    overflow: 'hidden',
    transformOrigin: 'bottom',
  },
  stub: {
    width: STUB,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: Spacing.lg,
  },
  caps: {
    letterSpacing: 0.6,
  },
  day: {
    fontSize: 34,
    lineHeight: 38,
  },
  perforation: {
    marginVertical: Spacing.sm,
  },
  body: {
    flex: 1,
    gap: Spacing.xs,
    padding: Spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  see: {
    minHeight: 44,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryFill,
  },
  done: {
    minHeight: 44,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.button,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 1.5,
    borderColor: Colors.text,
  },
  notch: {
    position: 'absolute',
    left: STUB - NOTCH / 2,
    width: NOTCH,
    height: NOTCH,
    borderRadius: NOTCH / 2,
    backgroundColor: Colors.canvas,
  },
  notchTop: {
    top: -NOTCH / 2,
  },
  notchBottom: {
    bottom: -NOTCH / 2,
  },
  caught: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    minHeight: 168,
    padding: Spacing.xl,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  center: {
    textAlign: 'center',
  },
  undoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingLeft: Spacing.lg,
    borderRadius: Radius.button,
    backgroundColor: Colors.surface,
  },
  grow: {
    flex: 1,
  },
  undoButton: {
    minHeight: 44,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
  },
}));
