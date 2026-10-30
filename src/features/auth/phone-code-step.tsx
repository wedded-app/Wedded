import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  ScrollView,
  TextInput,
  View,
  type TextInputInstance,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { FieldError } from '@/components/field-error';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { BorderWidth, makeStyles, Spacing, useColors } from '@/constants/theme';
import { PillButton } from '@/features/onboarding/onboarding-step';
import { useLocale } from '@/i18n/locale-context';
import { Motion } from '@/lib/motion';
import { supabase } from '@/lib/supabase';

import { toLatinDigits } from './about-you-validation';
import { authErrorKey } from './auth-helpers';
import type { Captcha } from './captcha';

const CODE_LENGTH = 6;
/** Supabase lets a number ask for a new code once a minute. */
const RESEND_SECONDS = 60;
/** Wait for the screen to finish sliding in before the keyboard comes up. */
export const FOCUS_DELAY_MS = 350;

export function sendCode(phone: string, captcha: Captcha) {
  return supabase.auth.signInWithOtp({
    phone,
    options: { shouldCreateUser: true, ...captcha.take() },
  });
}

export function CodeStep({
  captcha,
  phone,
  shown,
  onEdit,
  onVerified,
}: {
  captcha: Captcha;
  /** In E.164, to verify against. */
  phone: string;
  /** As it's shown: "(916) 555-0100". */
  shown: string;
  onEdit: () => void;
  onVerified: () => void;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const [code, setCode] = useState('');
  const [focused, setFocused] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);
  const [shakeStyle, shake] = useShake();
  const input = useRef<TextInputInstance>(null);

  useEffect(() => {
    const timer = setTimeout(() => input.current?.focus(), FOCUS_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function verify(token: string) {
    setError(undefined);
    setNotice(undefined);
    setVerifying(true);
    const { error: authError } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
    if (authError) {
      setVerifying(false);
      const message = t(authErrorKey(authError, 'phone'));
      setError(message);
      setCode('');
      shake();
      AccessibilityInfo.announceForAccessibility(message);
      input.current?.focus();
      return;
    }
    // Stays busy while the account loads and the screen closes.
    onVerified();
  }

  function change(text: string) {
    const digits = toLatinDigits(text).replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    setError(undefined);
    if (digits.length === CODE_LENGTH && !verifying) void verify(digits);
  }

  async function resend() {
    setError(undefined);
    setNotice(undefined);
    if (!captcha.ready) {
      setError(t('signIn.captchaWait'));
      return;
    }
    setResending(true);
    const { error: authError } = await sendCode(phone, captcha);
    setResending(false);
    if (authError) {
      setError(t(authErrorKey(authError, 'phone')));
      return;
    }
    const sent = t('signIn.newCodeTexted');
    setCooldown(RESEND_SECONDS);
    setNotice(sent);
    AccessibilityInfo.announceForAccessibility(sent);
  }

  const active = Math.min(code.length, CODE_LENGTH - 1);

  return (
    <>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.intro}>
          <AppText
            variant="display"
            weight={500}

            accessibilityRole="header"
            style={styles.title}
          >
            {t('phoneSignIn.codeTitle')}
          </AppText>
        </View>

        <View>
          <Animated.View style={[styles.boxes, shakeStyle]} accessible={false}>
            {Array.from({ length: CODE_LENGTH }, (_, index) => (
              <CodeBox
                key={index}
                digit={code[index]}
                active={focused && !verifying && index === active}
                error={error !== undefined}
              />
            ))}
          </Animated.View>
          {/* One real box over the six drawn ones: typing, pasting and the
              iPhone's code from Messages all land here. */}
          <TextInput
            ref={input}
            value={code}
            onChangeText={change}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            editable={!verifying}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={CODE_LENGTH}
            caretHidden
            accessibilityLabel={t('signIn.code')}
            style={styles.hiddenInput}
          />
        </View>

        <View style={styles.sentRow}>
          <AppText weight={500}>{t('phoneSignIn.sentTo', { phone: shown })}</AppText>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('phoneSignIn.changeNumber')}
            hitSlop={12}
            pressedScale={0.9}
            onPress={onEdit}
            style={styles.edit}
          >
            <Icon name="pencil-outline" size={20} color={Colors.text} weight="semibold" />
          </PressableScale>
        </View>

        {verifying && (
          <Animated.View entering={Motion.enter} style={styles.verifying}>
            <ActivityIndicator color={Colors.text} />
            <AppText color="text2">{t('signIn.signingIn')}</AppText>
          </Animated.View>
        )}
        {error && (
          <Animated.View entering={Motion.enter}>
            <FieldError message={error} />
          </Animated.View>
        )}
        {notice && (
          <AppText color="success" weight={500} style={styles.centered}>
            {notice}
          </AppText>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.pill}>
          <PillButton
            label={t('phoneSignIn.didntGet')}
            disabled={cooldown > 0 || verifying}
            loading={resending}
            onPress={resend}
          />
        </View>
        <AppText variant="caption" color="text2" style={styles.centered}>
          {cooldown > 0 ? t('signIn.resendIn', { seconds: cooldown }) : t('signIn.textDelay')}
        </AppText>
      </View>
    </>
  );
}

/** One of the six code boxes: the digit pops in, and the next empty one has a blinking caret. */
function CodeBox({ digit, active, error }: { digit?: string; active: boolean; error: boolean }) {
  const styles = useStyles();
  return (
    <View
      style={[
        styles.box,
        error ? styles.boxError : active ? styles.boxActive : digit ? styles.boxFilled : null,
      ]}
    >
      {digit ? (
        <Animated.View key={digit} entering={Motion.popIn}>
          <AppText variant="title" weight={600}>
            {digit}
          </AppText>
        </Animated.View>
      ) : (
        active && <Caret />
      )}
    </View>
  );
}

function Caret() {
  const styles = useStyles();
  const reduceMotion = useReducedMotion();
  const shown = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    shown.set(
      withRepeat(
        withSequence(withTiming(0, { duration: 500 }), withTiming(1, { duration: 500 })),
        -1,
      ),
    );
  }, [reduceMotion, shown]);

  const blink = useAnimatedStyle(() => ({ opacity: shown.value }));
  return <Animated.View style={[styles.caret, blink]} />;
}

/** A quick side-to-side shake for a wrong number or code. Still with Reduce Motion. */
export function useShake() {
  const reduceMotion = useReducedMotion();
  const offset = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));
  const shake = useCallback(() => {
    if (reduceMotion) return;
    const step = (x: number) => withTiming(x, { duration: 55 });
    offset.set(withSequence(step(-10), step(10), step(-7), step(7), step(-3), step(0)));
  }, [offset, reduceMotion]);
  return [style, shake] as const;
}

const useStyles = makeStyles((Colors) => ({
  fill: {
    flex: 1,
  },
  content: {
    gap: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  intro: {
    gap: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  title: {
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  centered: {
    textAlign: 'center',
  },
  footer: {
    gap: Spacing.md,
    paddingTop: Spacing.md,
  },
  pill: {
    alignSelf: 'center',
    width: '72%',
    minWidth: 240,
  },
  boxes: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  box: {
    flex: 1,
    aspectRatio: 0.78,
    maxHeight: 84,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: BorderWidth.control,
    borderColor: Colors.glassEdge,
    backgroundColor: Colors.canvasField,
    boxShadow: `0 6px 20px ${Colors.glassShadow}`,
  },
  boxFilled: {
    borderColor: Colors.borderInput,
  },
  boxActive: {
    borderColor: Colors.text,
    borderWidth: BorderWidth.strong,
  },
  boxError: {
    borderColor: Colors.error,
  },
  caret: {
    width: 2,
    height: 30,
    borderRadius: 1,
    backgroundColor: Colors.text,
  },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
  },
  sentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  edit: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifying: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
}));
