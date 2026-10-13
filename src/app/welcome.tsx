import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useState } from 'react';
import {
  BackHandler,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeOutUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, useTypeStyle } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { WeddingReel } from '@/components/wedding-reel';
import { SITE_URL_IS_PLACEHOLDER, siteLink } from '@/constants/links';
import {
  makeStyles,
  Radius,
  SchemeContext,
  Sizes,
  Spacing,
  Springs,
  useColors,
} from '@/constants/theme';
import { useSession } from '@/features/auth/session';
import { SignInOptions } from '@/features/auth/sign-in-options';
import { markOnboarding } from '@/features/onboarding/onboarding-state';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';
import { Motion } from '@/lib/motion';

const RIBBON = require('../../assets/images/ribbon-white.png');

// The lines that take turns above the buttons (`welcome.phrases.*`), the
// first one also what screen readers hear, and how long each one stays.
const PHRASES = ['plan', 'vendors', 'events', 'countdown', 'ask', 'rituals'] as const;
const PHRASE_MS = 3800;

// Shade over the video so white words read on any frame: a little all over,
// more behind the logo at the top and the words and buttons at the bottom.
const DIM = 'rgba(0, 0, 0, 0.12)';
const TOP_SHADE = 'linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 100%)';
const BOTTOM_SHADE =
  'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.5) 40%, rgba(0,0,0,0) 100%)';

const gradient = (css: string) =>
  (Platform.OS === 'web'
    ? { backgroundImage: css }
    : { experimental_backgroundImage: css }) as unknown as ViewStyle;

// A soft glow under the phrases, for frames as light as the words.
const phraseGlow = (Platform.OS === 'web'
  ? { textShadow: '0 1px 18px rgba(0,0,0,0.4)' }
  : {
      textShadowColor: 'rgba(0, 0, 0, 0.4)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 18,
    }) as unknown as TextStyle;

/**
 * The first screen a new person sees, like Hinge's: real weddings playing
 * across the whole screen, the ribbon and "Wedded" at the top, and at the
 * bottom a line that changes every few seconds (word by word, in Fraunces),
 * the terms, a white "Create account" pill, a plain "Sign in" and "Look
 * around" (browsing needs no account, App Store rule 5.1.1). Create account
 * and Sign in both swap those for the ways to sign in: one spring sinks the
 * first buttons, rises the white pills one after another and grows the space
 * they need, and Back plays it in reverse. New and returning people take the
 * same path, so only the words differ ("Continue with" or "Sign in with").
 * Phone opens the phone sign-in screen; email, the sign-in sheet. Always
 * light, in dark mode too. Once they're signed in, Home decides what's next.
 */
export default function WelcomeScreen() {
  return (
    <SchemeContext.Provider value="light">
      <Welcome />
    </SchemeContext.Provider>
  );
}

function Welcome() {
  const styles = useStyles();
  const Colors = useColors();
  const { t } = useLocale();
  const { status } = useSession();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [verb, setVerb] = useState<'continue' | 'signIn'>('continue');

  // 0 shows the first buttons, 1 the ways to sign in.
  const progress = useSharedValue(0);
  // Each panel's height, measured, so the space between them can grow smoothly.
  const startHeight = useSharedValue(0);
  const optionsHeight = useSharedValue(0);
  const ready = useSharedValue(0);

  // Back here signed in (Apple and Google finish on this screen; phone and
  // email finish on their own screens): About you if it's still missing,
  // otherwise on to the app.
  useFocusEffect(
    useCallback(() => {
      if (status === 'signedIn') router.replace('/');
      else if (status === 'needsProfile') router.push('/sign-in');
    }, [status]),
  );

  const move = useCallback(
    (toOpen: boolean) => {
      setOpen(toOpen);
      const target = toOpen ? 1 : 0;
      progress.set(
        reduceMotion ? withTiming(target, { duration: 220 }) : withSpring(target, Springs.smooth),
      );
    },
    [progress, reduceMotion],
  );

  // Android's back button closes the ways to sign in before leaving.
  useFocusEffect(
    useCallback(() => {
      if (!open) return;
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        move(false);
        return true;
      });
      return () => subscription.remove();
    }, [open, move]),
  );

  function openOptions(nextVerb: 'continue' | 'signIn') {
    selectionHaptic();
    setVerb(nextVerb);
    move(true);
  }

  function back() {
    selectionHaptic();
    move(false);
  }

  function browse() {
    selectionHaptic();
    markOnboarding('seen');
    router.replace('/');
  }

  function choose(method: 'phone' | 'email') {
    if (method === 'phone') router.push('/phone-sign-in');
    else router.push({ pathname: '/sign-in', params: { method } });
  }

  // The first measurement is taken as it is (nothing shows until both are
  // in); later ones, like an error card appearing, ease to the new height.
  const measure = (height: SharedValue<number>) => (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.height;
    height.set(height.get() === 0 ? next : withTiming(next, { duration: 200 }));
    if (startHeight.get() > 0 && optionsHeight.get() > 0 && ready.get() === 0) {
      ready.set(withTiming(1, { duration: 450 }));
    }
  };

  const lower = useAnimatedStyle(() => ({ opacity: ready.value }));
  const panels = useAnimatedStyle(() => ({
    height: startHeight.value + (optionsHeight.value - startHeight.value) * progress.value,
  }));
  const firstButtons = useAnimatedStyle(() => ({
    // Gone before the first pill starts rising, so the two never overlap.
    opacity: Math.max(0, 1 - progress.value * 3.5),
    transform: [
      { translateY: reduceMotion ? 0 : progress.value * 22 },
      { scale: reduceMotion ? 1 : 1 - progress.value * 0.04 },
    ],
  }));

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <WeddingReel />
      <View style={[StyleSheet.absoluteFill, styles.dim]} />
      <View style={[styles.topShade, gradient(TOP_SHADE)]} />
      <View style={[styles.bottomShade, gradient(BOTTOM_SHADE)]} />

      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.page,
          { paddingTop: insets.top + Spacing.sm, paddingBottom: insets.bottom + Spacing.sm },
        ]}
      >
        <Animated.View entering={Motion.enter} style={styles.brand}>
          <Image source={RIBBON} style={styles.ribbon} resizeMode="contain" />
          <AppText variant="heading" weight={800} color="onPhoto" style={styles.brandName}>
            {t('welcome.brand')}
          </AppText>
        </Animated.View>

        <View style={styles.spacer} />

        <Animated.View style={[styles.lower, lower]}>
          <Phrases />
          <Legal />
          <Animated.View style={panels}>
            <Animated.View
              onLayout={measure(startHeight)}
              aria-hidden={open}
              style={[styles.panel, firstButtons, open && styles.inert]}
            >
              <PressableScale
                accessibilityRole="button"
                onPress={() => openOptions('continue')}
                style={styles.create}
              >
                <AppText variant="button" weight={700} style={styles.createText}>
                  {t('welcome.createAccount')}
                </AppText>
              </PressableScale>
              <Pressable
                accessibilityRole="button"
                onPress={() => openOptions('signIn')}
                hitSlop={4}
                style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
              >
                <AppText variant="button" weight={700} color="onPhoto">
                  {t('welcome.signIn')}
                </AppText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={browse}
                hitSlop={6}
                style={({ pressed }) => [styles.browse, pressed && styles.pressed]}
              >
                <Icon name="compass-outline" size={18} color={Colors.onPhoto} />
                <AppText variant="label" weight={600} color="onPhoto">
                  {t('welcome.browse')}
                </AppText>
              </Pressable>
            </Animated.View>

            <View
              onLayout={measure(optionsHeight)}
              aria-hidden={!open}
              style={[styles.panel, !open && styles.inert]}
            >
              <SignInOptions
                hideUnavailable
                onPhoto
                verb={verb}
                reveal={progress}
                onChoose={choose}
                after={
                  <Pressable
                    accessibilityRole="button"
                    onPress={back}
                    hitSlop={4}
                    style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
                  >
                    <AppText variant="button" weight={700} color="onPhoto">
                      {t('common.back')}
                    </AppText>
                  </Pressable>
                }
              />
            </View>
          </Animated.View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

/**
 * The line above the buttons, taking turns with the other phrases: the old
 * one floats up and away, then the new one rises in word by word. Screen
 * readers hear the first phrase only, and with Reduce Motion it stays put.
 * Room for two lines is kept so nothing below jumps when a phrase is shorter.
 */
function Phrases() {
  const styles = useStyles();
  const { t } = useLocale();
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const { fontSize, lineHeight } = useTypeStyle({ variant: 'display', weight: 600, serif: true });

  useFocusEffect(
    useCallback(() => {
      if (reduceMotion) return;
      const timer = setInterval(() => setIndex((i) => (i + 1) % PHRASES.length), PHRASE_MS);
      return () => clearInterval(timer);
    }, [reduceMotion]),
  );

  const words = t(`welcome.phrases.${PHRASES[index]}`).split(' ');

  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel={t(`welcome.phrases.${PHRASES[0]}`)}
      style={[styles.phrases, { minHeight: lineHeight * 2 }]}
    >
      <Animated.View
        key={index}
        exiting={FadeOutUp.duration(260)}
        style={[styles.phrase, { columnGap: Math.round(fontSize * 0.26) }]}
      >
        {words.map((word, i) => (
          <Animated.View key={i} entering={FadeInDown.duration(520).delay(160 + i * 70)}>
            <AppText
              variant="display"
              weight={600}
              serif
              color="onPhoto"
              style={[styles.word, phraseGlow]}
            >
              {word}
            </AppText>
          </Animated.View>
        ))}
      </Animated.View>
    </View>
  );
}

/**
 * "By tapping Create account or Sign in, you agree to our Terms of Service…",
 * with the two names as links once the website has them (until there's a
 * domain they're plain words rather than links to nowhere).
 */
function Legal() {
  const styles = useStyles();
  const { t } = useLocale();
  // The sentence with markers where the two names go, so each language
  // keeps its own word order.
  const sentence = t('welcome.legal', { terms: '{terms}', privacy: '{privacy}' });
  const links = { '{terms}': 'terms', '{privacy}': 'privacy' } as const;

  return (
    <AppText variant="caption" color="onPhoto" style={styles.legal}>
      {sentence.split(/(\{terms\}|\{privacy\})/).map((part, index) => {
        const page = links[part as keyof typeof links];
        if (!page) return part;
        const label = t(page === 'terms' ? 'welcome.termsLink' : 'welcome.privacyLink');
        if (SITE_URL_IS_PLACEHOLDER) {
          return (
            <AppText key={index} variant="caption" weight={700} color="onPhoto">
              {label}
            </AppText>
          );
        }
        return (
          <AppText
            key={index}
            variant="caption"
            weight={700}
            color="onPhoto"
            accessibilityRole="link"
            onPress={() => void WebBrowser.openBrowserAsync(siteLink(`/${page}`))}
            style={styles.link}
          >
            {label}
          </AppText>
        );
      })}
    </AppText>
  );
}

const PILL_HEIGHT = 56;

const useStyles = makeStyles((Colors) => ({
  root: {
    flex: 1,
    backgroundColor: Colors.viewer,
  },
  dim: {
    pointerEvents: 'none',
    backgroundColor: DIM,
  },
  topShade: {
    pointerEvents: 'none',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 160,
  },
  bottomShade: {
    pointerEvents: 'none',
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '66%',
  },
  page: {
    flexGrow: 1,
    paddingHorizontal: Sizes.pageGutter + Spacing.xs,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: Sizes.tapTarget,
  },
  ribbon: {
    width: 40,
    height: 34,
  },
  brandName: {
    letterSpacing: -0.3,
  },
  spacer: {
    flexGrow: 1,
    minHeight: Spacing.xxl,
  },
  lower: {
    gap: Spacing.lg,
  },
  phrases: {
    justifyContent: 'flex-end',
  },
  phrase: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  word: {
    letterSpacing: -0.3,
  },
  legal: {
    textAlign: 'center',
    paddingHorizontal: Spacing.sm,
    opacity: 0.92,
  },
  link: {
    textDecorationLine: 'underline',
  },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: Spacing.sm,
  },
  inert: {
    pointerEvents: 'none',
  },
  create: {
    minHeight: PILL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.button,
    borderCurve: 'continuous',
    backgroundColor: Colors.canvas,
  },
  createText: {
    color: Colors.text,
  },
  textButton: {
    minHeight: Sizes.tapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  browse: {
    alignSelf: 'center',
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.button,
    borderCurve: 'continuous',
    backgroundColor: Colors.photoScrim,
  },
  pressed: {
    opacity: 0.6,
  },
}));
