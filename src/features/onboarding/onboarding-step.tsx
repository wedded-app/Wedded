import { router } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { FieldError } from '@/components/field-error';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { Screen } from '@/components/screen';
import { makeStyles, Radius, Sizes, Spacing, Springs, useColors } from '@/constants/theme';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';
import { Motion } from '@/lib/motion';

import { resetAnswers } from './answers';
import { markOnboarding } from './onboarding-state';
import { STEPS, stepNumber, type Step } from './steps';

export type OnboardingStepProps = {
  step: Step;
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Continue is greyed out until this is true. */
  canContinue?: boolean;
  onContinue: () => void;
  continueLabel?: string;
  /** A spinner on Continue while the answers are saved. */
  loading?: boolean;
  /** Said under the choices when saving failed. */
  error?: string;
  /** Shows Skip at the top right; skipping moves on without an answer. */
  onSkip?: () => void;
};

/**
 * One question of the first-launch setup, one per screen like Hinge: a round
 * Back (or Close on the first), a bar in three parts that fills as they go,
 * a big black question, the choices as soft grey bubbles, and a black
 * Continue pill pinned at the bottom. Always white (the layout sets light).
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
}: OnboardingStepProps) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const number = stepNumber(step);
  const first = number === 1;

  return (
    <Screen edges={['top', 'bottom']} plain>
      <View style={styles.bar}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={first ? t('onboarding.close') : t('common.back')}
          hitSlop={8}
          pressedScale={0.9}
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
          style={styles.round}
        >
          <Icon
            name={first ? 'close' : 'chevron-back'}
            size={22}
            color={Colors.text}
            weight="semibold"
          />
        </PressableScale>
        <View
          style={styles.progress}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={t('onboarding.stepOf', { step: number, total: STEPS.length })}
        >
          {STEPS.map((s, index) => (
            <Segment
              key={s}
              state={index + 1 < number ? 'done' : index + 1 === number ? 'now' : 'next'}
            />
          ))}
        </View>
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
        <Animated.View entering={Motion.rise} style={styles.intro}>
          <AppText variant="label" weight={600} color="text2">
            {t('onboarding.stepOf', { step: number, total: STEPS.length })}
          </AppText>
          <AppText variant="display" weight={800} accessibilityRole="header" style={styles.title}>
            {title}
          </AppText>
          {subtitle && (
            <AppText variant="bodyLg" color="text2">
              {subtitle}
            </AppText>
          )}
        </Animated.View>
        {children}
        {error && <FieldError message={error} />}
      </ScrollView>

      <View style={styles.footer}>
        <PillButton
          label={continueLabel ?? t('onboarding.continue')}
          disabled={!canContinue}
          loading={loading}
          onPress={onContinue}
        />
      </View>
    </Screen>
  );
}

/** One part of the progress bar: full when done, filling in for this question. */
function Segment({ state }: { state: 'done' | 'now' | 'next' }) {
  const styles = useStyles();
  const reduceMotion = useReducedMotion();
  const fill = useSharedValue(state === 'done' ? 1 : 0);

  useEffect(() => {
    const target = state === 'next' ? 0 : 1;
    fill.value =
      reduceMotion || state === 'done'
        ? target
        : withDelay(150, withSpring(target, Springs.smooth));
  }, [fill, reduceMotion, state]);

  const inner = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));

  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, inner]} />
    </View>
  );
}

/**
 * The big black pill at the bottom of the first questions (Continue, Take me
 * to my wedding): white text on black, grey when it can't be pressed yet.
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

const useStyles = makeStyles((Colors) => ({
  bar: {
    minHeight: Sizes.navBar,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.canvasCard,
  },
  progress: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  track: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: Colors.canvasCard,
  },
  fill: {
    height: '100%',
    borderRadius: 3,
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
    paddingTop: Spacing.xl,
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
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
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
    backgroundColor: Colors.canvasCard,
  },
}));
