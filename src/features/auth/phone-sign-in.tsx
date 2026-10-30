import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import Animated, {
  FadeInLeft,
  FadeInRight,
  FadeOutLeft,
  FadeOutRight,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmbientGlow } from '@/components/ambient-glow';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { makeStyles, SchemeContext, Sizes, Spacing, useColors } from '@/constants/theme';
import { useLocale } from '@/i18n/locale-context';

import { useCaptcha } from './captcha';
import { TurnstileBox } from './turnstile-box';
import { selectionHaptic } from '@/lib/haptics';
import { formatPhone } from '@/lib/phone';

import { CodeStep } from './phone-code-step';
import { DEFAULT_COUNTRY, type Country } from './phone-entry';
import { NumberStep } from './phone-number-step';
import { useSession } from './session';

type Step = 'number' | 'code';

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
  // One bot check for both steps, so a resend gets a fresh token (#234)
  const captcha = useCaptcha();

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
                captcha={captcha}
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
                captcha={captcha}
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
          <TurnstileBox captcha={captcha} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

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
}));
