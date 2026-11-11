import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  measure,
  useAnimatedRef,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnUI } from 'react-native-worklets';

import { AppText } from '@/components/app-text';
import { BottomSheet } from '@/components/bottom-sheet';
import { eventEmoji } from '@/components/event-icon';
import { Icon } from '@/components/icon';
import { SectionTitle } from '@/components/list';
import { StateView } from '@/components/state-view';
import { makeStyles, Sizes, Spacing, useColors } from '@/constants/theme';
import { useTraditions, type TraditionEvent } from '@/data/reference';
import { useStartPlanning } from '@/features/onboarding/start';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';

import { EVENT_PHOTOS } from './event-photos';

// The rail's column, a stop's dot, and each event's photo
const RAIL = 20;
const DOT = 12;
const PHOTO = 60;
// Where on the screen an event comes alive: a little below the middle, as in Your events
const FOCUS = 0.58;

/**
 * Plan by event on Home before there's a plan (Fezy, 2026-11-10: it should
 * be near the top, and is the reason to start a plan): how one tradition's
 * wedding comes together, its main events down a rail in the order they
 * happen, each with a photo (EVENT_PHOTOS, or its emoji) and when it usually
 * is. As Home scrolls the rail fills in ink and the event at the line a
 * little below the middle comes alive, its photo growing into full colour,
 * like Your events once there's a plan; still with Reduce Motion. A tap
 * opens the event's guide (/e/[slug]). The tradition shown is the default
 * one until they pick another from the chip. It ends at "Your dates go
 * here", which starts their plan.
 */
export function PlanByEvent({ scrollY }: { scrollY: SharedValue<number> }) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const { height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const traditions = useTraditions();
  const startPlanning = useStartPlanning();
  const [chosen, setChosen] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const listRef = useAnimatedRef<View>();
  const listTop = useSharedValue<number | null>(null);
  // Where the first and last dots sit in the list, so the rail runs between them
  const firstDot = useSharedValue(0);
  const lastDot = useSharedValue(0);
  const focus = height * FOCUS;

  const all = traditions.data ?? [];
  const tradition =
    all.find((tr) => tr.slug === chosen) ?? all.find((tr) => tr.isDefault) ?? all[0];
  const events = (tradition?.events ?? []).filter(
    (event) => event.isCore && event.phase !== 'whole_wedding',
  );

  const place = () =>
    scheduleOnUI(() => {
      'worklet';
      const box = measure(listRef);
      if (box) listTop.set(box.pageY + scrollY.get());
    });

  const rail = useAnimatedStyle(() => ({
    top: firstDot.value,
    height: Math.max(lastDot.value - firstDot.value, 0),
  }));
  const fill = useAnimatedStyle(() => {
    if (reduceMotion || listTop.value === null) return { height: '100%' };
    const reached = focus - (listTop.value - scrollY.value) - firstDot.value;
    return { height: Math.max(reached, 0) };
  });

  if (traditions.isPending) return <StateView state="loading" />;
  if (traditions.isError) {
    return <StateView state="error" onRetry={() => void traditions.refetch()} />;
  }
  if (!tradition || events.length === 0) return null;

  const name = localized(tradition.name);
  const first = localized(events[0].name);
  const last = localized(events[events.length - 1].name);

  return (
    <View style={styles.block} onLayout={place}>
      <View style={styles.head}>
        <View style={styles.grow}>
          <SectionTitle>{t('home.planByEvent')}</SectionTitle>
        </View>
        {all.length > 1 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('home.planBy.change', { tradition: name })}
            onPress={() => {
              selectionHaptic();
              setPicking(true);
            }}
            hitSlop={6}
            style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
          >
            <AppText variant="label" weight={600} numberOfLines={1}>
              {name}
            </AppText>
            <Icon name="chevron-down" size={14} color={Colors.text} weight="semibold" />
          </Pressable>
        )}
      </View>
      <AppText color="text2" style={styles.intro}>
        {t('home.planBy.intro', { tradition: name, first, last })}
      </AppText>

      <View ref={listRef} style={styles.list} onLayout={place}>
        <Animated.View style={[styles.rail, rail]} pointerEvents="none">
          <Animated.View style={[styles.railFill, fill]} />
        </Animated.View>
        {events.map((event, index) => (
          <Stop
            key={event.slug}
            event={event}
            listTop={listTop}
            scrollY={scrollY}
            focus={focus}
            still={reduceMotion}
            onDot={(y) => {
              if (index === 0) firstDot.set(y);
            }}
          />
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('home.planBy.datesTitle')}. ${t('home.planBy.datesBody')}`}
          onPress={() => {
            selectionHaptic();
            startPlanning();
          }}
          onLayout={(e) => lastDot.set(e.nativeEvent.layout.y + e.nativeEvent.layout.height / 2)}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <View style={styles.railColumn}>
            <View style={[styles.dot, styles.dotNext]} />
          </View>
          <View style={[styles.photo, styles.photoEmpty]}>
            <Icon name="add" size={24} color={Colors.primary} weight="semibold" />
          </View>
          <View style={styles.grow}>
            <AppText variant="bodyLg" weight={600}>
              {t('home.planBy.datesTitle')}
            </AppText>
            <AppText variant="label" weight={400} color="text2">
              {t('home.planBy.datesBody')}
            </AppText>
          </View>
          <AppText weight={600} color="primary">
            {t('home.planBy.start')}
          </AppText>
        </Pressable>
      </View>

      <BottomSheet title={picking ? t('home.planBy.pick') : null} onClose={() => setPicking(false)}>
        <View>
          {all.map((option, index) => {
            const on = option.slug === tradition.slug;
            return (
              <Pressable
                key={option.slug}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                onPress={() => {
                  selectionHaptic();
                  setChosen(option.slug);
                  setPicking(false);
                }}
                style={({ pressed }) => [
                  styles.option,
                  index > 0 && styles.divided,
                  pressed && styles.pressed,
                ]}
              >
                <AppText variant="bodyLg" weight={on ? 600 : 400} style={styles.grow}>
                  {localized(option.name)}
                </AppText>
                {on && <Icon name="checkmark" size={20} color={Colors.primary} weight="bold" />}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </View>
  );
}

/** One event: its dot on the rail, its photo, its name and when it usually is. */
function Stop({
  event,
  listTop,
  scrollY,
  focus,
  still,
  onDot,
}: {
  event: TraditionEvent;
  listTop: SharedValue<number | null>;
  scrollY: SharedValue<number>;
  focus: number;
  still: boolean;
  onDot: (y: number) => void;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const top = useSharedValue(0);
  const tall = useSharedValue(0);
  const name = localized(event.name);
  const timing = event.timing ? localized(event.timing) : null;
  const photo = EVENT_PHOTOS[event.slug];

  // How far this stop is below the focus line (negative once past it); null
  // when there's nothing to measure against (Reduce Motion, or not placed yet)
  const offset = useDerivedValue(() => {
    if (still || listTop.value === null) return null;
    return listTop.value + top.value + tall.value / 2 - scrollY.value - focus;
  });
  // 1 at the focus line, easing to 0 about a stop away
  const near = useDerivedValue(() => {
    if (offset.value === null) return 1;
    return interpolate(
      Math.abs(offset.value),
      [0, Math.max(tall.value, 1) * 1.2],
      [1, 0],
      Extrapolation.CLAMP,
    );
  });
  // The dot fills as the line reaches it
  const reached = useDerivedValue(() => {
    if (offset.value === null) return 1;
    return interpolate(offset.value, [10, -10], [0, 1], Extrapolation.CLAMP);
  });

  const dotFill = useAnimatedStyle(() => ({ transform: [{ scale: reached.value }] }));
  const lift = useAnimatedStyle(() => ({
    opacity: interpolate(near.value, [0, 1], [0.78, 1]),
    transform: [{ scale: interpolate(near.value, [0, 1], [1, 1.14]) }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={timing ? `${name}. ${timing}` : name}
      onPress={() => {
        selectionHaptic();
        router.push({ pathname: '/e/[slug]', params: { slug: event.slug } });
      }}
      onLayout={(e) => {
        const { y, height } = e.nativeEvent.layout;
        top.set(y);
        tall.set(height);
        onDot(y + height / 2);
      }}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.railColumn} pointerEvents="none">
        <View style={styles.dot}>
          <Animated.View style={[styles.dotFill, dotFill]} />
        </View>
      </View>
      <Animated.View style={[styles.photo, lift]}>
        {photo ? (
          <Image source={photo} style={styles.image} contentFit="cover" accessible={false} />
        ) : (
          <AppText style={styles.emoji} maxFontSizeMultiplier={1}>
            {eventEmoji(event.slug)}
          </AppText>
        )}
      </Animated.View>
      <View style={styles.grow}>
        <AppText variant="bodyLg" weight={600}>
          {name}
        </AppText>
        {timing && (
          <AppText variant="label" weight={400} color="text2">
            {timing}
          </AppText>
        )}
      </View>
      <Icon name="chevron-forward" size={16} color={Colors.text2} />
    </Pressable>
  );
}

const useStyles = makeStyles((Colors) => ({
  block: {
    gap: Spacing.sm,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingRight: Spacing.xs,
  },
  grow: {
    flex: 1,
    gap: 2,
  },
  chip: {
    maxWidth: '50%',
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: Colors.separator,
  },
  intro: {
    paddingRight: Spacing.lg,
  },
  list: {
    marginTop: Spacing.sm,
  },
  rail: {
    position: 'absolute',
    left: RAIL / 2 - 1,
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
    minHeight: PHOTO + Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  pressed: {
    opacity: 0.6,
  },
  railColumn: {
    width: RAIL,
    alignItems: 'center',
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
    backgroundColor: Colors.primaryFill,
  },
  dotNext: {
    borderColor: Colors.primary,
  },
  photo: {
    width: PHOTO,
    height: PHOTO,
    borderRadius: 16,
    borderCurve: 'continuous',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  photoEmpty: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.borderInput,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  emoji: {
    fontSize: 30,
    lineHeight: 36,
  },
  option: {
    minHeight: Sizes.row + 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  divided: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.separator,
  },
}));
