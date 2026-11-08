import { router } from 'expo-router';
import { useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  measure,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

import { AppText } from '@/components/app-text';
import { eventEmoji } from '@/components/event-icon';
import { PressableScale } from '@/components/pressable-scale';
import { makeStyles, Radius, Spacing, useColors } from '@/constants/theme';
import { daysUntil, essentialNeeds } from '@/features/planner/plan';
import { stillNeedsText, unbookedNames } from '@/features/planner/still-needs';
import type { usePlanView } from '@/features/planner/use-plan-view';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';

import { stubParts } from './greeting';
import { SectionHeader } from './section-header';
import { timelineOrder } from './timeline-order';

type PlanView = ReturnType<typeof usePlanView>;

// The rail's column, a stop's dot, how far down its card the dot sits (level
// with the date line), and the size of each event's decoration
const RAIL = 36;
const DOT = 14;
const DOT_TOP = Spacing.lg + 3;
const DECOR = 56;
// Where on the screen a stop comes alive: a little below the middle
const FOCUS = 0.58;

/**
 * Your events on Home as a timeline (Fezy, 2026-11-05), in the order they
 * happen: a rail down the left with a stop for each event, and beside it its
 * day, how long until it and in words what it still needs, or All set. Each
 * event wears its own decoration (`eventEmoji`: rings for the Nikah, a diya
 * for the Jaago). As Home scrolls, the rail fills in ink down to just below
 * the middle of the screen, each stop's dot fills as the line reaches it with
 * a light tick, and the event at that line comes alive: its decoration grows,
 * straightens and comes into full colour. With Reduce Motion it all shows
 * still and filled. A tap opens the event on the Wedding tab.
 */
export function EventsTimeline({
  view,
  scrollY,
}: {
  view: PlanView;
  scrollY: SharedValue<number>;
}) {
  const styles = useStyles();
  const { t } = useLocale();
  const { height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const listRef = useAnimatedRef<View>();
  // The list's top in Home's scrolling content, and its height; null until placed
  const listTop = useSharedValue<number | null>(null);
  // Where the last stop's dot sits in the list, so the rail ends there
  const lastDot = useSharedValue(0);
  const { plan, chosen, needsByEvent } = view;
  const focus = height * FOCUS;

  // Found from the screen, then kept in content terms, so scrolling alone moves it
  const place = () =>
    scheduleOnUI(() => {
      'worklet';
      const box = measure(listRef);
      if (box) listTop.set(box.pageY + scrollY.get());
    });

  const railLength = useAnimatedStyle(() => ({
    height: Math.max(lastDot.value - (DOT_TOP + DOT / 2), 0),
  }));
  const fill = useAnimatedStyle(() => {
    if (reduceMotion || listTop.value === null) return { height: '100%' };
    const reached = focus - (listTop.value - scrollY.value) - DOT_TOP - DOT / 2;
    return { height: Math.max(reached, 0) };
  });

  if (chosen.length === 0) return null;

  const ordered = timelineOrder(chosen, plan.eventDates);

  return (
    <View style={styles.block} onLayout={place}>
      <SectionHeader title={t('home.events.title')} />
      <View ref={listRef} style={styles.list} onLayout={place}>
        <Animated.View style={[styles.rail, railLength]} pointerEvents="none">
          <Animated.View style={[styles.railFill, fill]} />
        </Animated.View>
        {ordered.map((event, index) => {
          const names = unbookedNames(
            essentialNeeds(needsByEvent[event.slug]),
            plan.booked[event.slug] ?? [],
          );
          return (
            <Stop
              key={event.slug}
              slug={event.slug}
              name={localized(event.name)}
              date={plan.eventDates?.[event.slug] ?? plan.weddingDate}
              onDot={index === ordered.length - 1 ? (y) => lastDot.set(y) : undefined}
              status={stillNeedsText(names, t)}
              allSet={names.length === 0}
              listTop={listTop}
              scrollY={scrollY}
              focus={focus}
              still={reduceMotion}
            />
          );
        })}
      </View>
    </View>
  );
}

function Stop({
  slug,
  name,
  date,
  onDot,
  status,
  allSet,
  listTop,
  scrollY,
  focus,
  still,
}: {
  slug: string;
  name: string;
  date: string | null;
  /** The last stop says where its dot is, so the rail ends there. */
  onDot?: (y: number) => void;
  status: string;
  allSet: boolean;
  listTop: SharedValue<number | null>;
  scrollY: SharedValue<number>;
  focus: number;
  /** Reduce Motion: shown filled and in full colour, nothing moving. */
  still: boolean;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const top = useSharedValue(0);
  const tall = useSharedValue(0);

  // How far this stop's dot is below the focus line (negative once past it);
  // null when there's nothing to measure against (Reduce Motion, or not placed yet)
  const offset = useDerivedValue(() => {
    if (still || listTop.value === null) return null;
    return listTop.value + top.value + DOT_TOP + DOT / 2 - scrollY.value - focus;
  });
  // 1 at the focus line, easing to 0 about a stop away
  const near = useDerivedValue(() => {
    if (offset.value === null) return 1;
    return interpolate(
      Math.abs(offset.value),
      [0, Math.max(tall.value, 1) * 1.1],
      [1, 0],
      Extrapolation.CLAMP,
    );
  });
  // The dot fills as the line reaches it
  const reached = useDerivedValue(() => {
    if (offset.value === null) return 1;
    return interpolate(offset.value, [10, -10], [0, 1], Extrapolation.CLAMP);
  });

  // A light tick as the line reaches each stop on the way down
  useAnimatedReaction(
    () => (offset.value === null ? null : offset.value < 0),
    (passed, before) => {
      if (passed === true && before === false) scheduleOnRN(selectionHaptic);
    },
  );

  const dotFill = useAnimatedStyle(() => ({ transform: [{ scale: reached.value }] }));
  const halo = useAnimatedStyle(() => ({
    opacity: near.value * 0.9,
    transform: [{ scale: interpolate(near.value, [0, 1], [0.4, 1]) }],
  }));
  const decor = useAnimatedStyle(() => ({
    opacity: interpolate(near.value, [0, 1], [0.4, 1]),
    transform: [
      { translateY: interpolate(near.value, [0, 1], [6, 0]) },
      { scale: interpolate(near.value, [0, 1], [0.74, 1]) },
      { rotate: `${interpolate(near.value, [0, 1], [-14, 0])}deg` },
    ],
  }));

  const stub = stubParts(date);
  const days = date ? daysUntil(date) : null;
  const when = stub ? `${stub.weekday} · ${stub.month} ${stub.day}` : t('home.events.dateToCome');
  const until =
    days === null || days < 0
      ? null
      : days === 0
        ? t('home.events.today')
        : t('home.events.inDays', { count: days });
  const dateLine = until ? `${when} · ${until}` : when;

  return (
    <View
      style={styles.row}
      onLayout={(event: LayoutChangeEvent) => {
        top.set(event.nativeEvent.layout.y);
        tall.set(event.nativeEvent.layout.height);
        onDot?.(event.nativeEvent.layout.y + DOT_TOP + DOT / 2);
      }}
    >
      <View style={styles.railColumn} pointerEvents="none">
        <Animated.View style={[styles.halo, halo]} />
        <View style={styles.dot}>
          <Animated.View style={[styles.dotFill, dotFill]} />
        </View>
      </View>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${name}. ${dateLine}. ${status}`}
        pressedScale={0.98}
        onPress={() => {
          selectionHaptic();
          router.navigate({ pathname: '/plan', params: { event: slug } });
        }}
        style={styles.card}
      >
        <View style={styles.words}>
          <AppText variant="caption" weight={600} color="text2" style={styles.caps}>
            {dateLine.toUpperCase()}
          </AppText>
          <AppText variant="heading" weight={600} numberOfLines={2}>
            {name}
          </AppText>
          <View style={styles.status}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: allSet ? Colors.success : Colors.primary },
              ]}
            />
            <AppText
              variant="caption"
              weight={600}
              color={allSet ? 'success' : 'primary'}
              numberOfLines={2}
              style={styles.grow}
            >
              {status}
            </AppText>
          </View>
        </View>
        <View
          style={styles.decorBox}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
        >
          <Animated.View style={decor}>
            <AppText style={styles.decor} maxFontSizeMultiplier={1}>
              {eventEmoji(slug)}
            </AppText>
          </Animated.View>
        </View>
      </PressableScale>
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  block: {
    gap: Spacing.md,
  },
  list: {
    gap: Spacing.md,
  },
  rail: {
    position: 'absolute',
    left: RAIL / 2 - 1,
    top: DOT_TOP + DOT / 2,
    width: 2,
    borderRadius: 1,
    overflow: 'hidden',
    backgroundColor: Colors.separator,
  },
  railFill: {
    width: 2,
    backgroundColor: Colors.primaryFill,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  railColumn: {
    width: RAIL,
    alignItems: 'center',
    paddingTop: DOT_TOP,
  },
  halo: {
    position: 'absolute',
    top: DOT_TOP - (DOT * 2 - DOT) / 2,
    width: DOT * 2,
    height: DOT * 2,
    borderRadius: DOT,
    backgroundColor: Colors.primaryTint,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 2,
    borderColor: Colors.primaryFill,
    backgroundColor: Colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  dotFill: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: Colors.primaryFill,
  },
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 104,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  words: {
    flex: 1,
    gap: Spacing.xs,
  },
  caps: {
    letterSpacing: 0.6,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginTop: 5,
  },
  grow: {
    flex: 1,
  },
  decorBox: {
    width: DECOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decor: {
    fontSize: DECOR * 0.8,
    lineHeight: DECOR,
    textAlign: 'center',
  },
}));
