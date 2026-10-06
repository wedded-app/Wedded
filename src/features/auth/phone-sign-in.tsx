import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  FadeInLeft,
  FadeInRight,
  FadeOutLeft,
  FadeOutRight,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmbientGlow } from '@/components/ambient-glow';
import { AppText, useTypeStyle } from '@/components/app-text';
import { FieldError } from '@/components/field-error';
import { Icon } from '@/components/icon';
import { ListRow, ListSection } from '@/components/list';
import { PressableScale } from '@/components/pressable-scale';
import { SheetHeader } from '@/components/sheet-header';
import {
  BorderWidth,
  makeStyles,
  Radius,
  SchemeContext,
  Sizes,
  Spacing,
  useColors,
} from '@/constants/theme';
import { PillButton } from '@/features/onboarding/onboarding-step';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';
import { Motion } from '@/lib/motion';
import { formatPhone } from '@/lib/phone';
import { supabase } from '@/lib/supabase';

import { toLatinDigits } from './about-you-validation';
import { authErrorKey } from './auth-helpers';
import {
  COUNTRIES,
  DEFAULT_COUNTRY,
  formatPhoneDigits,
  nextPhoneDigits,
  phoneToE164,
  type Country,
} from './phone-entry';
import { useProviderState } from './providers';
import { useSession } from './session';

const CODE_LENGTH = 6;
/** Supabase lets a number ask for a new code once a minute. */
const RESEND_SECONDS = 60;
/** Wait for the screen to finish sliding in before the keyboard comes up. */
const FOCUS_DELAY_MS = 350;

type Step = 'number' | 'code';

function sendCode(phone: string) {
  return supabase.auth.signInWithOtp({ phone, options: { shouldCreateUser: true } });
}

/**
 * Signing in by text, like Hinge's: "What's your phone number?" in a big
 * serif with a country code pill beside the number, then "Enter your
 * verification code" in six boxes that fill as the digits arrive (the
 * iPhone offers the code from Messages). Each step slides in from the side.
 * New and returning people take the same path. Once the code works, it goes
 * back to the welcome screen, which sends them to About you or into the app.
 * Always light, like the welcome screen.
 */
export function PhoneSignIn() {
  return (
    <SchemeContext.Provider value="light">
      <PhoneSignInScreens />
    </SchemeContext.Provider>
  );
}

function PhoneSignInScreens() {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const { status } = useSession();
  const [step, setStep] = useState<Step>('number');
  // Which way the last step change went, for the slide; null on arrival.
  const [moved, setMoved] = useState<'forward' | 'back' | null>(null);
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [digits, setDigits] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, []);

  // The code worked: once the account has loaded, the welcome screen takes
  // it from here (About you for someone new, the app for someone back). If
  // the account can't be loaded, the sign-in sheet offers Try again.
  useEffect(() => {
    if (!verified) return;
    if (status === 'signedIn' || status === 'needsProfile') close();
    else if (status === 'error') router.replace('/sign-in');
  }, [verified, status, close]);

  const entering = moved === 'forward' ? FadeInRight : moved === 'back' ? FadeInLeft : undefined;
  const exiting = moved === 'back' ? FadeOutRight : FadeOutLeft;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <AmbientGlow />
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View
          style={[
            styles.page,
            { paddingTop: insets.top, paddingBottom: insets.bottom + Spacing.sm },
          ]}
        >
          <View style={styles.bar}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t('signIn.close')}
              hitSlop={8}
              pressedScale={0.9}
              onPress={() => {
                selectionHaptic();
                close();
              }}
              style={styles.close}
            >
              <Icon name="close" size={28} color={Colors.text} weight="semibold" />
            </PressableScale>
          </View>

          {step === 'number' || !sentTo ? (
            <Animated.View
              key="number"
              entering={entering?.duration(280)}
              exiting={exiting.duration(200)}
              style={styles.fill}
            >
              <NumberStep
                intro={moved === null}
                country={country}
                digits={digits}
                onCountry={setCountry}
                onDigits={setDigits}
                onSent={(phone) => {
                  setSentTo(phone);
                  setMoved('forward');
                  setStep('code');
                }}
              />
            </Animated.View>
          ) : (
            <Animated.View
              key="code"
              entering={entering?.duration(280)}
              exiting={exiting.duration(200)}
              style={styles.fill}
            >
              <CodeStep
                phone={sentTo}
                shown={sentTo.startsWith('+1') ? formatPhone(sentTo) : sentTo}
                onEdit={() => {
                  selectionHaptic();
                  setMoved('back');
                  setStep('number');
                }}
                onVerified={() => setVerified(true)}
              />
            </Animated.View>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function NumberStep({
  intro,
  country,
  digits,
  onCountry,
  onDigits,
  onSent,
}: {
  /** First arrival: the title, the number and Continue rise in one after another. */
  intro: boolean;
  country: Country;
  digits: string;
  onCountry: (country: Country) => void;
  onDigits: (digits: string) => void;
  /** The number the code went to, in E.164. */
  onSent: (phone: string) => void;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const { server } = useProviderState();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();
  const [focused, setFocused] = useState(false);
  const [picking, setPicking] = useState(false);
  const [shakeStyle, shake] = useShake();
  const input = useRef<TextInput>(null);
  const type = useTypeStyle({ variant: 'heading', weight: 500 });
  const countryName = t(`phoneSignIn.countries.${country.code}`);
  const rise = (index: number) => (intro ? Motion.stagger(index) : undefined);

  useEffect(() => {
    const timer = setTimeout(() => input.current?.focus(), FOCUS_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  function fail(message: string) {
    setError(message);
    shake();
    AccessibilityInfo.announceForAccessibility(message);
  }

  async function send() {
    const phone = phoneToE164(digits, country.dial);
    if (!phone) {
      fail(t(digits ? 'phoneSignIn.invalid' : 'phoneSignIn.required'));
      return;
    }
    setError(undefined);
    setSending(true);
    const { error: authError } = await sendCode(phone);
    setSending(false);
    if (authError) {
      fail(t(authErrorKey(authError, 'phone')));
      return;
    }
    onSent(phone);
  }

  return (
    <>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={rise(0)} style={styles.intro}>
          <AppText
            variant="display"
            weight={500}
            serif
            accessibilityRole="header"
            style={styles.title}
          >
            {t('phoneSignIn.title')}
          </AppText>
          <AppText color="text2" style={styles.centered}>
            {t('phoneSignIn.subtitle')}
          </AppText>
        </Animated.View>

        {/* The shake moves the row; rising in is on a wrapper, so the two
            transforms never fight. */}
        <Animated.View entering={rise(1)}>
          <Animated.View style={[styles.numberRow, shakeStyle]}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t('phoneSignIn.country', {
                country: countryName,
                dial: country.dial,
              })}
              pressedScale={0.95}
              onPress={() => {
                selectionHaptic();
                setPicking(true);
              }}
              style={styles.countryPill}
            >
              <AppText style={styles.flag} accessible={false}>
                {country.flag}
              </AppText>
              <AppText variant="heading" weight={500}>
                +{country.dial}
              </AppText>
              <Icon name="chevron-down" size={18} color={Colors.text2} weight="semibold" />
            </PressableScale>
            <View
              style={[
                styles.field,
                focused && styles.fieldFocused,
                error !== undefined && styles.fieldError,
              ]}
            >
              <TextInput
                ref={input}
                value={formatPhoneDigits(digits, country.dial)}
                onChangeText={(text) => {
                  setError(undefined);
                  onDigits(nextPhoneDigits(digits, text, country.dial));
                }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder={t('phoneSignIn.placeholder')}
                placeholderTextColor={Colors.text2}
                accessibilityLabel={t('phoneSignIn.placeholder')}
                keyboardType="number-pad"
                textContentType="telephoneNumber"
                autoComplete="tel"
                returnKeyType="done"
                onSubmitEditing={send}
                maxFontSizeMultiplier={type.maxFontSizeMultiplier}
                style={[
                  styles.input,
                  {
                    fontFamily: type.fontFamily,
                    fontWeight: 'fontWeight' in type ? type.fontWeight : undefined,
                    fontSize: type.fontSize,
                    color: Colors.text,
                  },
                ]}
              />
            </View>
          </Animated.View>
        </Animated.View>

        {error && (
          <Animated.View entering={Motion.enter}>
            <FieldError message={error} />
          </Animated.View>
        )}

        {(!server || server.email) && (
          <Animated.View entering={rise(2)}>
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => {
                selectionHaptic();
                router.replace({ pathname: '/sign-in', params: { method: 'email' } });
              }}
              style={({ pressed }) => [styles.textLink, pressed && styles.pressed]}
            >
              <AppText weight={600}>{t('phoneSignIn.useEmail')}</AppText>
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>

      <Animated.View entering={rise(3)} style={styles.footer}>
        <View style={styles.pill}>
          <PillButton label={t('phoneSignIn.continue')} loading={sending} onPress={send} />
        </View>
        <AppText variant="caption" color="text2" style={styles.centered}>
          {t('phoneSignIn.smallPrint')}
        </AppText>
      </Animated.View>

      <CountrySheet
        visible={picking}
        selected={country}
        onPick={(next) => {
          selectionHaptic();
          setPicking(false);
          onCountry(next);
          // The longest number differs by country; trim to the new one.
          onDigits(nextPhoneDigits('', digits, next.dial));
        }}
        onClose={() => setPicking(false)}
      />
    </>
  );
}

function CodeStep({
  phone,
  shown,
  onEdit,
  onVerified,
}: {
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
  const input = useRef<TextInput>(null);

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
    setResending(true);
    const { error: authError } = await sendCode(phone);
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
            serif
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

/** The countries to pick a calling code from, as an iPhone page sheet. */
function CountrySheet({
  visible,
  selected,
  onPick,
  onClose,
}: {
  visible: boolean;
  selected: Country;
  onPick: (country: Country) => void;
  onClose: () => void;
}) {
  const styles = useStyles();
  const { t } = useLocale();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.sheet}>
        <SheetHeader onClose={onClose} title={t('phoneSignIn.countryTitle')} />
        <ScrollView contentContainerStyle={styles.sheetContent}>
          <ListSection>
            {COUNTRIES.map((country) => (
              <ListRow
                key={country.code}
                title={t(`phoneSignIn.countries.${country.code}`)}
                leading={
                  <AppText style={styles.flag} accessible={false}>
                    {country.flag}
                  </AppText>
                }
                value={`+${country.dial}`}
                checked={country.code === selected.code}
                accessibilityRole="radio"
                onPress={() => onPick(country)}
              />
            ))}
          </ListSection>
        </ScrollView>
      </View>
    </Modal>
  );
}

/** A quick side-to-side shake for a wrong number or code. Still with Reduce Motion. */
function useShake() {
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

const FIELD_HEIGHT = 64;

const useStyles = makeStyles((Colors) => ({
  root: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  fill: {
    flex: 1,
  },
  page: {
    flex: 1,
    paddingHorizontal: Sizes.pageGutter + Spacing.xs,
  },
  bar: {
    minHeight: Sizes.navBar,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
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
  numberRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  countryPill: {
    minHeight: FIELD_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.button,
    borderCurve: 'continuous',
    borderWidth: BorderWidth.control,
    borderColor: Colors.glassEdge,
    backgroundColor: Colors.canvasField,
    boxShadow: `0 6px 20px ${Colors.glassShadow}`,
  },
  flag: {
    fontSize: 24,
    lineHeight: 30,
  },
  field: {
    flex: 1,
    minHeight: FIELD_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.button,
    borderCurve: 'continuous',
    borderWidth: BorderWidth.control,
    borderColor: Colors.glassEdge,
    backgroundColor: Colors.canvasField,
    boxShadow: `0 6px 20px ${Colors.glassShadow}`,
  },
  fieldFocused: {
    borderColor: Colors.text,
  },
  fieldError: {
    borderColor: Colors.error,
  },
  input: {
    minHeight: FIELD_HEIGHT - 4,
    padding: 0,
    // The field draws its own focus ring; no browser outline inside it.
    outlineWidth: 0,
  },
  textLink: {
    alignSelf: 'center',
    minHeight: Sizes.tapTarget,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.5,
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
  sheet: {
    flex: 1,
    paddingHorizontal: Sizes.pageGutter,
    backgroundColor: Colors.bg,
  },
  sheetContent: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
}));
