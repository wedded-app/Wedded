import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  View,
  type TextInputInstance,
} from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText, useTypeStyle } from '@/components/app-text';
import { FieldError } from '@/components/field-error';
import { Icon } from '@/components/icon';
import { ListRow, ListSection } from '@/components/list';
import { PressableScale } from '@/components/pressable-scale';
import { SheetHeader } from '@/components/sheet-header';
import { BorderWidth, makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import { PillButton } from '@/features/onboarding/onboarding-step';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';
import { Motion } from '@/lib/motion';

import { authErrorKey } from './auth-helpers';
import type { Captcha } from './captcha';
import { FOCUS_DELAY_MS, sendCode, useShake } from './phone-code-step';
import {
  COUNTRIES,
  formatPhoneDigits,
  nextPhoneDigits,
  phoneToE164,
  type Country,
} from './phone-entry';
import { useProviderState } from './providers';

export function NumberStep({
  captcha,
  intro,
  country,
  digits,
  onCountry,
  onDigits,
  onSent,
}: {
  captcha: Captcha;
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
  const input = useRef<TextInputInstance>(null);
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
    if (!captcha.ready) {
      fail(t('signIn.captchaWait'));
      return;
    }
    setError(undefined);
    setSending(true);
    const { error: authError } = await sendCode(phone, captcha);
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

const FIELD_HEIGHT = 64;

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
