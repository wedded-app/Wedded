import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type ViewInstance,
} from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';

import { AppText } from '@/components/app-text';
import { makeStyles, Spacing, Timing, useColors } from '@/constants/theme';
import { PillButton } from '@/features/onboarding/onboarding-step';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';
import { iosEasing } from '@/lib/motion';

export type TourKey = 'top' | 'events' | 'guests' | 'wed';

/** Where a part of the page is on the screen. */
type Box = { x: number; y: number; width: number; height: number };

/**
 * The parts of the Wedding tab the tour points at. `spot(key)` goes on the
 * view to light up (its ref), `place(key)` on the block of the page it's in
 * (where that sits in the page's scroll), and `target(key)` on a block
 * that's both.
 */
export function useTourTargets() {
  const views = useRef<Partial<Record<TourKey, ViewInstance | null>>>({});
  const tops = useRef<Partial<Record<TourKey, number>>>({});
  const spot = (key: TourKey) => ({
    ref: (view: ViewInstance | null) => {
      views.current[key] = view;
    },
    collapsable: false,
  });
  const place = (key: TourKey) => ({
    onLayout: (event: { nativeEvent: { layout: { y: number } } }) => {
      tops.current[key] = event.nativeEvent.layout.y;
    },
  });
  const target = (key: TourKey) => ({ ...spot(key), ...place(key) });
  return { views, tops, spot, place, target };
}

type Targets = ReturnType<typeof useTourTargets>;

/** The hole around a part: a little room on every side. */
const PAD = 8;
/** How long the page takes to scroll a part into view before it's measured. */
const SETTLE = 380;

/** The dim page with a rounded hole cut out, as one path (the hole by the even-odd rule). */
function spotlight(width: number, height: number, box: Box, radius: number): string {
  const x = box.x - PAD;
  const y = box.y - PAD;
  const w = box.width + PAD * 2;
  const h = box.height + PAD * 2;
  const r = Math.min(radius, w / 2, h / 2);
  return [
    `M0 0H${width}V${height}H0Z`,
    `M${x + r} ${y}H${x + w - r}`,
    `A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}`,
    `A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}`,
    `A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}`,
    `A${r} ${r} 0 0 1 ${x + r} ${y}Z`,
  ].join('');
}

/**
 * The Wedding tab's first-visit tour (Fezy, 2026-11-06), shown once per
 * phone: the page dims, a rounded hole lights up one part at a time (the
 * top, the events, For your guests, then Wed's bow), and a small card says
 * in a line what it's for, with Skip and Next. The page scrolls each part
 * into view first. Tapping the dim page moves on too. `scrollTo` scrolls
 * the page to a y in its content; `onDone` is called after the last part
 * or Skip.
 */
export function WeddingTour({
  targets,
  steps,
  scrollTo,
  onDone,
}: {
  targets: Targets;
  /** The parts to show, in order; one that isn't on the page is skipped. */
  steps: TourKey[];
  scrollTo: (y: number) => void;
  onDone: () => void;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const [at, setAt] = useState(0);
  // Where the part being shown was found on the screen, once it has been
  const [found, setFound] = useState<{ key: TourKey; box: Box } | null>(null);
  const shown = steps.filter((key) => targets.views.current[key]);
  const key = shown[at];
  const last = at >= shown.length - 1;
  const box = found && found.key === key ? found.box : null;

  // Scroll the part into view (the bow stays put at the top), then find it on the screen
  useEffect(() => {
    if (!key) return;
    const top = targets.tops.current[key];
    if (key === 'top') scrollTo(0);
    else if (key !== 'wed' && top !== undefined) scrollTo(Math.max(0, top - height * 0.22));
    const measure = () =>
      targets.views.current[key]?.measureInWindow((x, y, w, h) =>
        setFound({ key, box: { x, y, width: w, height: h } }),
      );
    // Once as the scroll lands, and again in case it was still gliding
    const timers = [
      setTimeout(measure, reduceMotion ? 60 : SETTLE),
      setTimeout(measure, reduceMotion ? 200 : SETTLE + 320),
    ];
    return () => timers.forEach(clearTimeout);
  }, [key, targets, scrollTo, height, reduceMotion]);

  const next = () => {
    selectionHaptic();
    if (last) onDone();
    else setAt(at + 1);
  };

  if (!key) return null;
  // The card goes under the hole when there's room, else over it
  const below = box ? box.y + box.height + PAD + 220 < height - insets.bottom : true;
  const clipped = box && {
    ...box,
    y: Math.max(box.y, insets.top),
    height: Math.min(box.y + box.height, height - insets.bottom - 90) - Math.max(box.y, insets.top),
  };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onDone}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={last ? t('planner.tour.done') : t('planner.tour.next')}
        onPress={next}
        style={StyleSheet.absoluteFill}
      >
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          {clipped ? (
            <Path
              d={spotlight(width, height, clipped, key === 'wed' ? 999 : 26)}
              fill="rgba(0, 0, 0, 0.62)"
              fillRule="evenodd"
            />
          ) : (
            <Rect x={0} y={0} width={width} height={height} fill="rgba(0, 0, 0, 0.62)" />
          )}
        </Svg>
      </Pressable>
      {clipped && (
        <Animated.View
          key={key}
          entering={reduceMotion ? undefined : FadeIn.duration(Timing.quick).easing(iosEasing)}
          style={[
            styles.card,
            below
              ? { top: clipped.y + clipped.height + PAD + Spacing.md }
              : { bottom: height - clipped.y + PAD + Spacing.md },
          ]}
          accessibilityViewIsModal
        >
          <AppText variant="caption" weight={600} color="text2">
            {t('planner.tour.stepOf', { step: at + 1, total: shown.length })}
          </AppText>
          <AppText variant="heading" weight={700} accessibilityRole="header">
            {t(`planner.tour.${key}.title`)}
          </AppText>
          <AppText color="text2">{t(`planner.tour.${key}.body`)}</AppText>
          <View style={styles.buttons}>
            {!last ? (
              <Pressable
                accessibilityRole="button"
                hitSlop={12}
                onPress={() => {
                  selectionHaptic();
                  onDone();
                }}
                style={({ pressed }) => [styles.skip, pressed && styles.pressed]}
              >
                <AppText weight={600} color="text2">
                  {t('planner.tour.skip')}
                </AppText>
              </Pressable>
            ) : (
              <View />
            )}
            <View style={styles.next}>
              <PillButton
                label={last ? t('planner.tour.done') : t('planner.tour.next')}
                onPress={next}
              />
            </View>
          </View>
        </Animated.View>
      )}
      {/* A ring around the hole, so it reads as lit rather than cut */}
      {clipped && (
        <View
          style={[
            styles.ring,
            {
              left: clipped.x - PAD,
              top: clipped.y - PAD,
              width: clipped.width + PAD * 2,
              height: clipped.height + PAD * 2,
              borderRadius: key === 'wed' ? 999 : 26,
              borderColor: Colors.onHero,
            },
          ]}
        />
      )}
    </Modal>
  );
}

const useStyles = makeStyles((Colors) => ({
  card: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    gap: Spacing.sm,
    padding: Spacing.xl,
    borderRadius: 26,
    borderCurve: 'continuous',
    backgroundColor: Colors.bg,
    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.25)',
  },
  buttons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  skip: {
    minHeight: 48,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.5,
  },
  next: {
    minWidth: 140,
  },
  ring: {
    position: 'absolute',
    pointerEvents: 'none',
    borderWidth: 2,
    opacity: 0.85,
  },
}));
