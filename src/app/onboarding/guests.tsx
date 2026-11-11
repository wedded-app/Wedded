import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Icon, type IconName } from '@/components/icon';
import { makeStyles, Spacing, Timing, useColors } from '@/constants/theme';
import { useSession } from '@/features/auth/session';
import { setAnswers, useAnswers } from '@/features/onboarding/answers';
import { useFinishOnboarding } from '@/features/onboarding/finish';
import {
  bandForCount,
  countForBand,
  MAX_GUESTS,
  MIN_GUESTS,
  stepGuests,
} from '@/features/onboarding/guest-count';
import { OnboardingStep } from '@/features/onboarding/onboarding-step';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic, successHaptic } from '@/lib/haptics';
import { iosEasing } from '@/lib/motion';
import { useCountUp } from '@/lib/use-count-up';

// Each seat dot stands for this many guests; 50 dots seat MAX_GUESTS
const PER_DOT = 20;
const DOTS = MAX_GUESTS / PER_DOT;
const COLUMNS = 10;

/**
 * Question 5, the last: about how many guests, at the biggest event. A big
 * number they nudge 25 at a time with − and + (hold to keep going), over
 * rows of seats that fill in maroon as it grows, and a line saying which
 * halls that means. Only the band is kept (guest-count). Continue makes
 * their plan: in their account when they're signed in, otherwise on this
 * phone until they save it. Then "Your plan is ready".
 */
export default function GuestsStep() {
  const { t } = useLocale();
  const answers = useAnswers();
  const { status } = useSession();
  const { finish, keepOnPhone, saving } = useFinishOnboarding();
  const [failed, setFailed] = useState(false);
  const count = answers.guestCount ?? countForBand(answers.guestBand);
  const band = bandForCount(count);

  const change = (direction: 1 | -1) => {
    const next = stepGuests(count, direction);
    if (next === count) return;
    selectionHaptic();
    setAnswers({ guestCount: next, guestBand: bandForCount(next) });
  };

  const done = async () => {
    setFailed(false);
    if (status !== 'signedIn') {
      keepOnPhone();
      successHaptic();
      router.replace('/onboarding/ready');
      return;
    }
    try {
      await finish();
      successHaptic();
      router.replace('/onboarding/ready');
    } catch {
      setFailed(true);
    }
  };

  return (
    <OnboardingStep
      step="guests"
      title={t('onboarding.guests.title')}
      subtitle={t('onboarding.guests.subtitle')}
      continueLabel={t('onboarding.guests.finish')}
      loading={saving}
      error={failed ? t('onboarding.guests.failed') : undefined}
      onContinue={() => {
        // What they see is their answer, even untouched
        setAnswers({ guestCount: count, guestBand: band });
        void done();
      }}
      onSkip={() => void done()}
    >
      <Guests count={count} band={band} onChange={change} />
    </OnboardingStep>
  );
}

/** The number, the seats filling under it, − and + either side, and what it means for halls. */
function Guests({
  count,
  band,
  onChange,
}: {
  count: number;
  band: string;
  onChange: (direction: 1 | -1) => void;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const reduceMotion = useReducedMotion();
  const shown = useCountUp(count, 260);
  // The seats fill in as the page arrives, as the number counts up
  const seats = useSharedValue(reduceMotion ? count : 0);

  useEffect(() => {
    seats.value = reduceMotion
      ? count
      : withTiming(count, { duration: Timing.quick + 120, easing: iosEasing });
  }, [seats, reduceMotion, count]);

  return (
    <View style={styles.guests}>
      <View
        style={styles.number}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={t('onboarding.guests.label')}
        accessibilityValue={{ text: t('onboarding.guests.count', { count }) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) =>
          onChange(event.nativeEvent.actionName === 'increment' ? 1 : -1)
        }
      >
        <AppText weight={700} style={styles.big} maxFontSizeMultiplier={1.2}>
          {count >= MAX_GUESTS ? `${shown}+` : String(shown)}
        </AppText>
        <AppText variant="label" weight={500} color="text2">
          {t('onboarding.guests.unit')}
        </AppText>
      </View>

      <View style={styles.seats} accessible={false} importantForAccessibility="no-hide-descendants">
        {Array.from({ length: DOTS }, (_, index) => (
          <Seat
            key={index}
            index={index}
            seats={seats}
            off={Colors.separator}
            on={Colors.primary}
          />
        ))}
      </View>

      <View style={styles.controls}>
        <StepButton
          icon="remove"
          label={t('onboarding.guests.fewer')}
          disabled={count <= MIN_GUESTS}
          onStep={() => onChange(-1)}
        />
        <AppText variant="label" weight={600} color="primary" style={styles.band}>
          {t(`onboarding.guests.fits.${band}`)}
        </AppText>
        <StepButton
          icon="add"
          label={t('onboarding.guests.more')}
          disabled={count >= MAX_GUESTS}
          onStep={() => onChange(1)}
        />
      </View>
      <AppText variant="label" color="text2" style={styles.halls}>
        {t('onboarding.guests.halls')}
      </AppText>
    </View>
  );
}

/** One seat: grey, filling maroon and growing to full size as the count reaches it. */
function Seat({
  index,
  seats,
  off,
  on,
}: {
  index: number;
  seats: SharedValue<number>;
  off: string;
  on: string;
}) {
  const styles = useStyles();
  const style = useAnimatedStyle(() => {
    const filled = Math.min(Math.max(seats.value / PER_DOT - index, 0), 1);
    return {
      backgroundColor: interpolateColor(filled, [0, 1], [off, on]),
      transform: [{ scale: interpolate(filled, [0, 1], [0.7, 1]) }],
    };
  });
  return (
    <View style={styles.seatBox}>
      <Animated.View style={[styles.seat, style]} />
    </View>
  );
}

/** A round − or +: one step a tap, and steps on while it's held. */
function StepButton({
  icon,
  label,
  disabled,
  onStep,
}: {
  icon: IconName;
  label: string;
  disabled: boolean;
  onStep: () => void;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const held = useRef<ReturnType<typeof setTimeout> | null>(null);
  const step = useRef(onStep);
  useEffect(() => {
    step.current = onStep;
  });

  const stop = () => {
    if (held.current) clearTimeout(held.current);
    held.current = null;
  };
  const repeat = () => {
    held.current = setTimeout(() => {
      step.current();
      repeat();
    }, 110);
  };
  useEffect(() => stop, []);
  useEffect(() => {
    if (disabled) stop();
  }, [disabled]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onStep}
      onLongPress={() => {
        step.current();
        repeat();
      }}
      delayLongPress={380}
      onPressOut={stop}
      style={({ pressed }) => [
        styles.stepButton,
        pressed && styles.pressed,
        disabled && styles.stepOff,
      ]}
    >
      <Icon name={icon} size={24} color={Colors.text} weight="semibold" />
    </Pressable>
  );
}

const SEAT = 14;

const useStyles = makeStyles((Colors) => ({
  guests: {
    gap: Spacing.xl,
    paddingTop: Spacing.sm,
  },
  number: {
    alignItems: 'center',
  },
  big: {
    fontSize: 76,
    lineHeight: 84,
    letterSpacing: -2.5,
    fontVariant: ['tabular-nums'],
  },
  seats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  seatBox: {
    width: `${100 / COLUMNS}%`,
    alignItems: 'center',
  },
  seat: {
    width: SEAT,
    height: SEAT,
    borderRadius: SEAT / 2,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  band: {
    flex: 1,
    textAlign: 'center',
  },
  halls: {
    textAlign: 'center',
    marginTop: -Spacing.md,
  },
  stepButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.borderInput,
    backgroundColor: Colors.canvas,
  },
  stepOff: {
    opacity: 0.35,
  },
  pressed: {
    opacity: 0.55,
  },
}));
