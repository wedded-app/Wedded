import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { makeStyles, Radius, Spacing, Timing, useColors } from '@/constants/theme';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';
import { iosEasing } from '@/lib/motion';

export const ASK_STEPS = 5;

export type AskStepProps = {
  /** 1 to 5. */
  step: number;
  /** "Ask Capitol Rose" or "Visit Capitol Rose", under the step number. */
  heading: string;
  /** The vendor's cover photo, beside the heading. */
  photo?: string | null;
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** A few words beside the arrow: what they picked, or how many they answered. */
  summary?: ReactNode;
  /** The arrow is grey until this is true. */
  canContinue?: boolean;
  onContinue?: () => void;
  /** Replaces the summary and arrow (the last page's Send). */
  footer?: ReactNode;
  /** The first page closes instead of going back. */
  onClose?: () => void;
};

/**
 * One page of Ask for a quote, after Fezy's mockup (2026-11-11) and like
 * List your business: Back (Close on the first) in a round tan button, "Step
 * 2 of 5" over who they're asking, the vendor's photo, and one thin maroon
 * line that fills as they go. The question is big and bold, the answers
 * under it, and the round black arrow sits at the bottom right beside a few
 * words of what they picked. The bottom rises with the keyboard.
 */
export function AskStep({
  step,
  heading,
  photo,
  title,
  subtitle,
  children,
  summary,
  canContinue = true,
  onContinue,
  footer,
  onClose,
}: AskStepProps) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const first = !!onClose;

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.top}>
        <View style={styles.bar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={first ? t('ask.close') : t('common.back')}
            hitSlop={6}
            onPress={() => {
              selectionHaptic();
              if (onClose) onClose();
              else if (router.canGoBack()) router.back();
            }}
            style={({ pressed }) => [styles.round, pressed && styles.pressed]}
          >
            <Icon
              name={first ? 'close' : 'chevron-back'}
              size={20}
              color={Colors.text}
              weight="semibold"
            />
          </Pressable>
          <View style={styles.heading}>
            <AppText variant="caption" weight={600} color="text2" style={styles.caps}>
              {t('ask.stepOf', { step, total: ASK_STEPS }).toUpperCase()}
            </AppText>
            <AppText weight={700} numberOfLines={1}>
              {heading}
            </AppText>
          </View>
          {photo ? (
            <Image source={{ uri: photo }} style={styles.thumb} contentFit="cover" />
          ) : (
            <View style={[styles.thumb, styles.noPhoto]}>
              <Icon name="storefront-outline" size={20} color={Colors.text2} />
            </View>
          )}
        </View>
        <ProgressLine
          from={(step - 1) / ASK_STEPS}
          to={step / ASK_STEPS}
          label={t('ask.stepOf', { step, total: ASK_STEPS })}
        />
      </View>

      <ScrollView
        style={styles.grow}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
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
      </ScrollView>

      {footer ?? (
        <View style={styles.footer}>
          <View style={styles.grow}>
            {typeof summary === 'string' ? (
              <AppText variant="label" color="text2" numberOfLines={2}>
                {summary}
              </AppText>
            ) : (
              summary
            )}
          </View>
          <NextArrow disabled={!canContinue} onPress={() => onContinue?.()} />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

/** The thin maroon line under the heading, filling this page's share as it slides in. */
function ProgressLine({ from, to, label }: { from: number; to: number; label: string }) {
  const styles = useStyles();
  const reduceMotion = useReducedMotion();
  const value = useSharedValue(reduceMotion ? to : from);

  useEffect(() => {
    value.value = reduceMotion ? to : withTiming(to, { duration: Timing.page, easing: iosEasing });
  }, [value, reduceMotion, to]);

  const fill = useAnimatedStyle(() => ({ width: `${value.value * 100}%` }));

  return (
    <View
      style={styles.track}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(to * 100) }}
    >
      <Animated.View style={[styles.fill, fill]} />
    </View>
  );
}

/** The round black arrow: grey until the page has what it needs, shrinking a little under the finger. */
export function NextArrow({
  disabled = false,
  loading = false,
  onPress,
}: {
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const reduceMotion = useReducedMotion();
  const ready = useSharedValue(disabled ? 0 : 1);
  const [off, on] = [Colors.separator, Colors.primaryFill];

  useEffect(() => {
    const target = disabled ? 0 : 1;
    ready.value = reduceMotion
      ? target
      : withTiming(target, { duration: Timing.quick, easing: iosEasing });
  }, [ready, reduceMotion, disabled]);

  const fill = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(ready.value, [0, 1], [off, on]),
  }));

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={t('ask.next')}
      accessibilityState={{ disabled, busy: loading }}
      disabled={disabled || loading}
      pressedScale={0.92}
      onPress={() => {
        selectionHaptic();
        onPress();
      }}
    >
      <Animated.View style={[styles.next, fill]}>
        {loading ? (
          <ActivityIndicator color={Colors.onPrimary} />
        ) : (
          <Icon name="arrow-forward" size={26} color={Colors.onPrimary} weight="semibold" />
        )}
      </Animated.View>
    </PressableScale>
  );
}

const NEXT = 64;
const THUMB = 44;

const useStyles = makeStyles((Colors) => ({
  page: {
    flex: 1,
  },
  grow: {
    flex: 1,
  },
  top: {
    gap: Spacing.md,
    paddingTop: Spacing.sm,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.sand,
  },
  pressed: {
    opacity: 0.6,
  },
  heading: {
    flex: 1,
    gap: 1,
  },
  caps: {
    letterSpacing: 0.6,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: Radius.thumb + 2,
    borderCurve: 'continuous',
  },
  noPhoto: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.sand,
  },
  track: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: Colors.sand,
  },
  fill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  content: {
    gap: Spacing.xxl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  intro: {
    gap: Spacing.sm,
  },
  title: {
    letterSpacing: -0.6,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  next: {
    width: NEXT,
    height: NEXT,
    borderRadius: NEXT / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
