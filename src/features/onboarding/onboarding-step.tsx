import { router } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { FieldError } from '@/components/field-error';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { Screen } from '@/components/screen';
import { makeStyles, Radius, Sizes, Spacing, Timing, useColors } from '@/constants/theme';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';
import { iosEasing } from '@/lib/motion';

import { resetAnswers } from './answers';
import { markOnboarding } from './onboarding-state';
import { PlanPreview } from './plan-preview';
import { progressFor, STEPS, stepNumber, type Step } from './steps';

export type OnboardingStepProps = {
  step: Step;
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** The arrow is greyed out until this is true. */
  canContinue?: boolean;
  onContinue: () => void;
  /** What the arrow does, for screen readers; defaults to "Continue". */
  continueLabel?: string;
  /** A spinner in the arrow while the answers are saved. */
  loading?: boolean;
  /** Said under the choices when saving failed. */
  error?: string;
  /** Shows Skip at the top right; skipping moves on without an answer. */
  onSkip?: () => void;
  /**
   * How far this question fills its share of the progress bar, and where the
   * fill starts: the first question fills half when "Where are the families
   * from?" may follow, and that question fills the rest.
   */
  fill?: number;
  fillFrom?: number;
};

/**
 * One question of the first-launch setup, one per screen, after Hinge's: a
 * plain Back (or Close on the first), one thin bar that fills as they go, the
 * question big and bold, the answers as plain rows, and at the bottom their
 * plan so far (after the first question) beside a round black arrow. The page
 * arrives whole with the iPhone's own slide: nothing fades in after it, so it
 * never feels like waiting. White and black; always light (the layout sets it).
 */
export function OnboardingStep({
  step,
  title,
  subtitle,
  children,
  canContinue = true,
  onContinue,
  continueLabel,
  loading = false,
  error,
  onSkip,
  fill = 1,
  fillFrom = 0,
}: OnboardingStepProps) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const first = step === STEPS[0];
  const progress = progressFor(step, fill, fillFrom);

  return (
    <Screen edges={['top', 'bottom']} plain>
      <View style={styles.bar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={first ? t('onboarding.close') : t('common.back')}
          hitSlop={8}
          onPress={() => {
            selectionHaptic();
            if (!first && router.canGoBack()) {
              router.back();
              return;
            }
            // Closing the first question: not now. Home offers it again.
            markOnboarding('seen');
            resetAnswers();
            router.replace('/');
          }}
          style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}
        >
          <Icon
            name={first ? 'close' : 'chevron-back'}
            size={26}
            color={Colors.text}
            weight="semibold"
          />
        </Pressable>
        <ProgressBar
          from={progress.from}
          to={progress.to}
          label={t('onboarding.stepOf', { step: stepNumber(step), total: STEPS.length })}
        />
        <View style={styles.side}>
          {onSkip && (
            <Pressable
              accessibilityRole="button"
              hitSlop={12}
              onPress={() => {
                selectionHaptic();
                onSkip();
              }}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <AppText weight={600} color="text2">
                {t('onboarding.skip')}
              </AppText>
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.intro}>
          <AppText variant="display" weight={700} accessibilityRole="header" style={styles.title}>
            {title}
          </AppText>
          {subtitle && (
            <AppText variant="bodyLg" color="text2">
              {subtitle}
            </AppText>
          )}
        </View>
        {children}
        {error && <FieldError message={error} />}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.preview}>{!first && <PlanPreview step={step} />}</View>
        <NextButton
          label={continueLabel ?? t('onboarding.continue')}
          disabled={!canContinue}
          loading={loading}
          onPress={onContinue}
        />
      </View>
    </Screen>
  );
}

/**
 * The thin bar at the top: it starts where the last question left it and
 * fills this question's share on the iPhone's curve as the page slides in.
 * List your business (/for-vendors) uses it too.
 */
export function ProgressBar({ from, to, label }: { from: number; to: number; label: string }) {
  const styles = useStyles();
  const reduceMotion = useReducedMotion();
  const value = useSharedValue(reduceMotion ? to : from);

  useEffect(() => {
    value.value = reduceMotion ? to : withTiming(to, { duration: Timing.page, easing: iosEasing });
  }, [value, reduceMotion, to]);

  const inner = useAnimatedStyle(() => ({ width: `${value.value * 100}%` }));

  return (
    <View
      style={styles.track}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(to * 100) }}
    >
      <Animated.View style={[styles.fill, inner]} />
    </View>
  );
}

/**
 * Hinge's round black arrow, bottom right: grey until the question has an
 * answer, then black, shrinking a little under the finger.
 */
export function NextButton({
  label,
  onPress,
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  loading: boolean;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const reduceMotion = useReducedMotion();
  const ready = useSharedValue(disabled ? 0 : 1);
  // Ink: black on white, white on black (List your business follows dark mode)
  const [offColor, onColor] = [Colors.separator, Colors.text];

  useEffect(() => {
    const target = disabled ? 0 : 1;
    ready.value = reduceMotion
      ? target
      : withTiming(target, { duration: Timing.quick, easing: iosEasing });
  }, [ready, reduceMotion, disabled]);

  const fillStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(ready.value, [0, 1], [offColor, onColor]),
  }));

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy: loading }}
      disabled={disabled || loading}
      pressedScale={0.92}
      onPress={() => {
        selectionHaptic();
        onPress();
      }}
    >
      <Animated.View style={[styles.next, fillStyle]}>
        {loading ? (
          <ActivityIndicator color={Colors.canvas} />
        ) : (
          <Icon name="arrow-forward" size={26} color={Colors.canvas} weight="semibold" />
        )}
      </Animated.View>
    </PressableScale>
  );
}

/**
 * The big black pill for a labelled action, like "Take me to my wedding" at
 * the end: white text on black, grey when it can't be pressed yet.
 */
export function PillButton({
  label,
  onPress,
  disabled = false,
  loading = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const off = disabled || loading;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled, busy: loading }}
      disabled={off}
      onPress={() => {
        selectionHaptic();
        onPress();
      }}
      style={[styles.pill, disabled && styles.pillOff]}
    >
      {loading ? (
        <ActivityIndicator color={Colors.canvas} />
      ) : (
        <AppText
          variant="button"
          weight={700}
          style={{ color: disabled ? Colors.textDisabled : Colors.canvas }}
        >
          {label}
        </AppText>
      )}
    </PressableScale>
  );
}

const NEXT_SIZE = 64;

const useStyles = makeStyles((Colors) => ({
  bar: {
    minHeight: Sizes.navBar,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  navButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -Spacing.sm,
  },
  track: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: Colors.separator,
  },
  fill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: Colors.text,
  },
  side: {
    minWidth: 44,
    alignItems: 'flex-end',
  },
  pressed: {
    opacity: 0.5,
  },
  content: {
    gap: Spacing.xl,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xl,
  },
  intro: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  title: {
    letterSpacing: -0.5,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  preview: {
    flex: 1,
  },
  next: {
    width: NEXT_SIZE,
    height: NEXT_SIZE,
    borderRadius: NEXT_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.button,
    borderCurve: 'continuous',
    backgroundColor: Colors.text,
  },
  pillOff: {
    backgroundColor: Colors.sand,
  },
}));
