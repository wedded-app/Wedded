import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  LayoutAnimationConfig,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { makeStyles, Spacing, Timing, useColors } from '@/constants/theme';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';
import { iosEasing } from '@/lib/motion';

export const MIN_GUESTS = 10;
export const MAX_GUESTS = 1000;
export const GUEST_STEP = 10;
/** Each little person stands for this many guests: 50 of them at the most. */
export const PER_PERSON = 20;
const COLUMNS = 10;
const ROWS = MAX_GUESTS / PER_PERSON / COLUMNS;
const THUMB = 34;

/** A count kept on the slider's steps and inside its ends. */
export function clampGuests(count: number): number {
  return Math.min(MAX_GUESTS, Math.max(MIN_GUESTS, Math.round(count / GUEST_STEP) * GUEST_STEP));
}

/**
 * "About how many guests?" (Fezy's mockup, 2026-11-11): the number, big,
 * with − and + either side; little people filling in under it, one for
 * every 20 guests, turning maroon past what the hall seats; and a slider to
 * drag, with the hall's seats marked on it. Not sure greys it all.
 */
export function GuestPicker({
  count,
  unsure,
  seats,
  onChange,
}: {
  count: number;
  unsure: boolean;
  /** What the hall seats, when it said. */
  seats?: number;
  onChange: (count: number) => void;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const nudge = (direction: 1 | -1) => {
    const next = clampGuests(count + direction * GUEST_STEP);
    if (next !== count) onChange(next);
  };

  return (
    <View style={styles.picker}>
      <View style={styles.numberRow}>
        <StepButton
          icon="remove"
          label={t('ask.guests.fewer')}
          disabled={count <= MIN_GUESTS}
          onPress={() => nudge(-1)}
        />
        <View
          style={styles.number}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={t('ask.guests.label')}
          accessibilityValue={{ text: t('ask.guests.count', { number: count }) }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(event) =>
            nudge(event.nativeEvent.actionName === 'increment' ? 1 : -1)
          }
        >
          <AppText
            weight={700}
            color={unsure ? 'textDisabled' : 'text'}
            style={styles.big}
            maxFontSizeMultiplier={1.2}
          >
            {count >= MAX_GUESTS ? `${count}+` : String(count)}
          </AppText>
          <AppText variant="label" color="text2">
            {t('ask.guests.unit')}
          </AppText>
        </View>
        <StepButton
          icon="add"
          label={t('ask.guests.more')}
          disabled={count >= MAX_GUESTS}
          onPress={() => nudge(1)}
        />
      </View>

      <People count={count} seats={seats} faded={unsure} />
      <AppText variant="caption" color="text2" style={styles.center}>
        {t('ask.guests.each', { number: PER_PERSON })}
      </AppText>

      <Slider count={count} seats={seats} onChange={onChange} />

      {seats !== undefined && !unsure && (
        <View style={styles.fit} accessibilityLiveRegion="polite">
          <View
            style={[
              styles.dot,
              { backgroundColor: count <= seats ? Colors.success : Colors.primary },
            ]}
          />
          <AppText weight={600} color={count <= seats ? 'success' : 'primary'} style={styles.grow}>
            {count <= seats ? t('ask.guests.fits') : t('ask.guests.over', { seats })}
          </AppText>
        </View>
      )}
    </View>
  );
}

/** The little people, ten to a row; the rows' room is kept so the page never jumps. */
function People({ count, seats, faded }: { count: number; seats?: number; faded: boolean }) {
  const Colors = useColors();
  const styles = useStyles();
  const reduceMotion = useReducedMotion();
  const shown = Math.min(Math.ceil(count / PER_PERSON), COLUMNS * ROWS);
  return (
    <LayoutAnimationConfig skipEntering>
      <View
        style={styles.people}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      >
        {Array.from({ length: shown }, (_, index) => {
          const over = seats !== undefined && (index + 1) * PER_PERSON > seats;
          return (
            <Animated.View
              key={index}
              entering={reduceMotion ? undefined : ZoomIn.duration(Timing.quick)}
              style={styles.person}
            >
              <Svg width={20} height={26} viewBox="0 0 22 28">
                <Circle
                  cx={11}
                  cy={5}
                  r={4.5}
                  fill={faded ? Colors.separator : over ? Colors.primary : Colors.text}
                />
                <Path
                  d="M3.5 27V15a7.5 7.5 0 0 1 15 0v12z"
                  fill={faded ? Colors.separator : over ? Colors.primary : Colors.text}
                />
              </Svg>
            </Animated.View>
          );
        })}
      </View>
    </LayoutAnimationConfig>
  );
}

/**
 * The slider: drag the round handle, or tap the line. It moves in tens and
 * gives a small tap every fifty; the hall's seats are a maroon mark on it.
 */
function Slider({
  count,
  seats,
  onChange,
}: {
  count: number;
  seats?: number;
  onChange: (count: number) => void;
}) {
  const styles = useStyles();
  const { t } = useLocale();
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const track = useSharedValue(0);
  const at = useSharedValue(count / MAX_GUESTS);
  const last = useSharedValue(count);
  const dragging = useSharedValue(false);

  // − and + (and Ask again) move the handle too, unless a finger is on it
  useEffect(() => {
    if (dragging.get()) return;
    last.set(count);
    at.set(
      reduceMotion
        ? count / MAX_GUESTS
        : withTiming(count / MAX_GUESTS, { duration: Timing.quick, easing: iosEasing }),
    );
  }, [count, at, last, dragging, reduceMotion]);

  const change = (next: number) => {
    if (next % 50 === 0) selectionHaptic();
    onChange(next);
  };

  const moveTo = (x: number) => {
    'worklet';
    const w = track.get();
    if (w <= 0) return;
    const fraction = Math.min(1, Math.max(0, x / w));
    const steps = Math.round((fraction * MAX_GUESTS) / GUEST_STEP) * GUEST_STEP;
    const next = Math.min(MAX_GUESTS, Math.max(MIN_GUESTS, steps));
    at.set(next / MAX_GUESTS);
    if (next !== last.get()) {
      last.set(next);
      scheduleOnRN(change, next);
    }
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-4, 4])
    .failOffsetY([-14, 14])
    .onStart((event) => {
      dragging.set(true);
      moveTo(event.x);
    })
    .onUpdate((event) => moveTo(event.x))
    .onFinalize(() => dragging.set(false));
  const tap = Gesture.Tap().onEnd((event) => moveTo(event.x));

  const handle = useAnimatedStyle(() => ({
    transform: [{ translateX: at.get() * track.get() - THUMB / 2 }],
  }));
  const filled = useAnimatedStyle(() => ({ width: at.get() * track.get() }));

  const seatsAt = seats !== undefined ? Math.min(1, seats / MAX_GUESTS) : null;

  return (
    <GestureHandlerRootView>
      <GestureDetector gesture={Gesture.Race(pan, tap)}>
        <View
          style={styles.slider}
          onLayout={(event) => {
            const w = event.nativeEvent.layout.width;
            track.set(w);
            setWidth(w);
          }}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={t('ask.guests.label')}
          accessibilityValue={{ min: MIN_GUESTS, max: MAX_GUESTS, now: count }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(event) =>
            onChange(
              clampGuests(
                count + (event.nativeEvent.actionName === 'increment' ? GUEST_STEP : -GUEST_STEP),
              ),
            )
          }
        >
          <View style={styles.rail}>
            <Animated.View style={[styles.railFill, filled]} />
          </View>
          {seatsAt !== null && <View style={[styles.seatsMark, { left: seatsAt * width - 1 }]} />}
          <Animated.View style={[styles.handle, handle]} />
        </View>
      </GestureDetector>
      <View style={styles.ticks}>
        <AppText variant="caption" color="text2">
          0
        </AppText>
        {seatsAt !== null && width > 0 && (
          <AppText
            variant="caption"
            weight={600}
            color="primary"
            style={[
              styles.seatsLabel,
              { left: Math.min(Math.max(seatsAt * width - 40, 24), width - 104) },
            ]}
          >
            {t('ask.guests.seats', { seats: seats ?? 0 })}
          </AppText>
        )}
        <AppText variant="caption" color="text2">
          {`${MAX_GUESTS}+`}
        </AppText>
      </View>
    </GestureHandlerRootView>
  );
}

/** − or +, a round outlined button the size of a fingertip. */
function StepButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: 'add' | 'remove';
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const Colors = useColors();
  const styles = useStyles();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      pressedScale={0.9}
      onPress={() => {
        selectionHaptic();
        onPress();
      }}
      style={[styles.step, disabled && styles.stepOff]}
    >
      <Icon name={icon} size={22} color={Colors.text} weight="semibold" />
    </PressableScale>
  );
}

const useStyles = makeStyles((Colors) => ({
  picker: {
    gap: Spacing.lg,
  },
  grow: {
    flex: 1,
  },
  center: {
    textAlign: 'center',
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  number: {
    flex: 1,
    alignItems: 'center',
  },
  big: {
    fontSize: 64,
    lineHeight: 70,
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums'],
  },
  step: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  stepOff: {
    opacity: 0.35,
  },
  people: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'flex-start',
    justifyContent: 'flex-start',
    rowGap: 6,
    height: ROWS * 26 + (ROWS - 1) * 6,
    marginHorizontal: Spacing.sm,
  },
  person: {
    width: '10%',
    alignItems: 'center',
  },
  slider: {
    height: 44,
    justifyContent: 'center',
    marginHorizontal: THUMB / 2,
  },
  rail: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: Colors.sand,
  },
  railFill: {
    height: '100%',
    backgroundColor: Colors.primaryFill,
  },
  seatsMark: {
    position: 'absolute',
    top: 11,
    width: 2,
    height: 22,
    borderRadius: 1,
    backgroundColor: Colors.primary,
  },
  handle: {
    position: 'absolute',
    left: 0,
    top: (44 - THUMB) / 2,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 1.5,
    borderColor: Colors.primaryFill,
    backgroundColor: Colors.canvas,
    boxShadow: '0 3px 10px rgba(0, 0, 0, 0.2)',
  },
  ticks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: THUMB / 2 - 4,
    minHeight: 20,
  },
  seatsLabel: {
    position: 'absolute',
    top: 0,
    width: 80,
    textAlign: 'center',
  },
  fit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
}));
