import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { type SharedValue } from 'react-native-reanimated';

import { AppText, useFontScale } from '@/components/app-text';
import { FieldError } from '@/components/field-error';
import { Icon, type IconName } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { Reveal } from '@/components/reveal';
import { BorderWidth, Radius, Spacing, useScheme, type Scheme } from '@/constants/theme';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';
import { Motion } from '@/lib/motion';

import {
  signInWithApple,
  signInWithGoogle,
  useProviderState,
  type ProviderResult,
} from './providers';

type Method = 'apple' | 'google' | 'phone' | 'email';
type Look = 'apple' | 'outlined';
type Brand = { fill: string; stroke: string; text: string };

// Brand colours, not theme tokens: Apple's button is black on light pages and
// white on dark ones; Google's light and dark buttons are #FFFFFF / #747775 /
// #1F1F1F and #131314 / #8E918F / #E3E3E3 (Google's sign-in branding
// guidelines). Phone and email wear Google's style so the four read as a set.
const BRAND: Record<Scheme, Record<Look, Brand>> = {
  light: {
    apple: { fill: '#000000', stroke: '#000000', text: '#FFFFFF' },
    outlined: { fill: '#FFFFFF', stroke: '#747775', text: '#1F1F1F' },
  },
  dark: {
    apple: { fill: '#FFFFFF', stroke: '#FFFFFF', text: '#000000' },
    outlined: { fill: '#131314', stroke: '#8E918F', text: '#E3E3E3' },
  },
};

// Over the welcome video all four are white, like Hinge's: Apple allows its
// white button on dark backgrounds, and this is Google's light button.
const ON_PHOTO: Brand = { fill: '#FFFFFF', stroke: '#747775', text: '#1F1F1F' };

const PILL_HEIGHT = 56;
const ICON_SIZE = 20;

type Verb = 'continue' | 'signIn';

const LABEL_KEY: Record<Verb, Record<Method, string>> = {
  continue: {
    apple: 'signIn.withApple',
    google: 'signIn.withGoogle',
    phone: 'signIn.withPhone',
    email: 'signIn.withEmail',
  },
  signIn: {
    apple: 'signIn.signInWithApple',
    google: 'signIn.signInWithGoogle',
    phone: 'signIn.signInWithPhone',
    email: 'signIn.signInWithEmail',
  },
};

// The Google "G" as a one-colour Ionicon for now; the store build needs
// Google's official four-colour G (see docs/HOSTED_SETUP.md).
const ICON: Record<Method, IconName> = {
  apple: 'logo-apple',
  google: 'logo-google',
  phone: 'call-outline',
  email: 'mail-outline',
};

/**
 * "Continue with" (or "Sign in with") Apple, Google, phone and email: four
 * equal pills, Apple first and only on iPhone. Methods the server has turned
 * off show greyed with "Coming soon", or not at all with `hideUnavailable`
 * (the welcome screen, which keeps its words few). Apple and Google sign in
 * right here (a spinner on the tapped pill, a plain-words error under the
 * pills if it fails); phone and email call `onChoose`, or open the sign-in
 * sheet on that method. `onPhoto` draws them all white for the welcome
 * video, and `reveal` raises them one after another as it goes to 1, with
 * `after` (the welcome screen's Back) last.
 */
export function SignInOptions({
  onChoose,
  hideUnavailable = false,
  verb = 'continue',
  onPhoto = false,
  reveal,
  after,
}: {
  onChoose?: (method: 'phone' | 'email') => void;
  hideUnavailable?: boolean;
  verb?: Verb;
  onPhoto?: boolean;
  reveal?: SharedValue<number>;
  after?: ReactNode;
}) {
  const { t } = useLocale();
  const { server, appleDevice } = useProviderState();
  const [busy, setBusy] = useState<'apple' | 'google' | null>(null);
  const [error, setError] = useState<string>();

  // Until the server answers (or when it can't be reached), everything looks
  // available: better than greying buttons that turn out to work.
  const isOn = (method: Method) => !server || server[method];
  const all: Method[] = appleDevice
    ? ['apple', 'google', 'phone', 'email']
    : ['google', 'phone', 'email'];
  const methods = hideUnavailable ? all.filter(isOn) : all;

  async function signIn(provider: 'apple' | 'google') {
    setError(undefined);
    setBusy(provider);
    let result: ProviderResult;
    try {
      result = provider === 'apple' ? await signInWithApple() : await signInWithGoogle();
    } catch {
      result = 'failed';
    }
    setBusy(null);
    if (result === 'failed') {
      setError(
        t(provider === 'apple' ? 'signIn.errors.appleFailed' : 'signIn.errors.googleFailed'),
      );
    } else if (result === 'unavailable') {
      setError(t(provider === 'apple' ? 'signIn.errors.appleOff' : 'signIn.errors.googleOff'));
    }
  }

  function choose(method: Method) {
    selectionHaptic();
    if (method === 'apple' || method === 'google') {
      void signIn(method);
    } else if (onChoose) {
      onChoose(method);
    } else {
      router.push({ pathname: '/sign-in', params: { method } });
    }
  }

  return (
    <View style={styles.list}>
      {methods.map((method, index) => {
        const pill = (
          <OptionPill
            key={method}
            method={method}
            label={t(LABEL_KEY[verb][method])}
            onPhoto={onPhoto}
            comingSoon={!isOn(method)}
            loading={busy === method}
            // One sign-in at a time.
            blocked={busy !== null && busy !== method}
            onPress={() => choose(method)}
          />
        );
        return reveal ? (
          <Reveal key={method} progress={reveal} index={index}>
            {pill}
          </Reveal>
        ) : (
          pill
        );
      })}
      {error &&
        (onPhoto ? (
          // Red on a video can't be read: the error sits on a white card.
          <Animated.View entering={Motion.enter} style={styles.errorCard}>
            <FieldError message={error} />
          </Animated.View>
        ) : (
          <FieldError message={error} />
        ))}
      {after &&
        (reveal ? (
          <Reveal progress={reveal} index={methods.length}>
            {after}
          </Reveal>
        ) : (
          after
        ))}
    </View>
  );
}

function OptionPill({
  method,
  label,
  onPhoto,
  comingSoon,
  loading,
  blocked,
  onPress,
}: {
  method: Method;
  label: string;
  onPhoto: boolean;
  comingSoon: boolean;
  loading: boolean;
  blocked: boolean;
  onPress: () => void;
}) {
  const { t } = useLocale();
  const scheme = useScheme();
  const scale = useFontScale('button');
  const brand = onPhoto ? ON_PHOTO : BRAND[scheme][method === 'apple' ? 'apple' : 'outlined'];
  const disabled = comingSoon || blocked || loading;
  const iconSize = Math.round(ICON_SIZE * scale);

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={comingSoon ? `${label}, ${t('common.comingSoon')}` : label}
      accessibilityState={{ disabled: comingSoon || blocked, busy: loading }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.pill,
        { backgroundColor: brand.fill, borderColor: brand.stroke },
        comingSoon && styles.off,
      ]}
    >
      <View style={[styles.side, { width: iconSize }]}>
        {loading ? (
          <ActivityIndicator color={brand.text} />
        ) : (
          <Icon
            name={ICON[method]}
            // The Apple logo sits optically small next to text.
            size={method === 'apple' ? Math.round(iconSize * 1.1) : iconSize}
            color={brand.text}
            weight="semibold"
          />
        )}
      </View>
      <View style={styles.words}>
        <AppText variant="button" style={[styles.center, { color: brand.text }]}>
          {label}
        </AppText>
        {comingSoon && (
          <AppText variant="caption" style={[styles.center, { color: brand.text }]}>
            {t('common.comingSoon')}
          </AppText>
        )}
      </View>
      {/* Balances the icon so the label sits in the middle of the pill. */}
      <View style={{ width: iconSize }} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.md,
  },
  pill: {
    minHeight: PILL_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.button,
    borderCurve: 'continuous',
    borderWidth: BorderWidth.hairline,
  },
  off: {
    opacity: 0.45,
  },
  side: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  words: {
    flex: 1,
    alignItems: 'center',
  },
  center: {
    textAlign: 'center',
  },
  errorCard: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.field,
    borderCurve: 'continuous',
    // White under the light theme's red, like the pills (brand colours above).
    backgroundColor: '#FFFFFF',
  },
});
