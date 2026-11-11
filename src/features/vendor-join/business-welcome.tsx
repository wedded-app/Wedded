import { router, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { GlassButton } from '@/components/glass-button';
import { Icon, type IconName } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import {
  backgroundCss,
  makeStyles,
  Radius,
  Sizes,
  Spacing,
  useColors,
  useScheme,
} from '@/constants/theme';
import { useIsVendor } from '@/data/chat';
import { Clip } from '@/features/auth/join-choice';
import { useSession } from '@/features/auth/session';
import { switchToBusiness } from '@/features/business/app-mode';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';

const VIDEO = require('../../../assets/videos/join-business.mp4');
const POSTER = require('../../../assets/images/join-business.jpg');

// Shade so white words read on any frame, as on the sign-up pages
const DIM = 'rgba(0, 0, 0, 0.12)';
const TOP_SHADE = 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 100%)';
const BOTTOM_SHADE =
  'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.7) 55%, rgba(0,0,0,0) 100%)';

const PROMISES: { key: 'free' | 'families' | 'calendar'; icon: IconName }[] = [
  { key: 'free', icon: 'gift-outline' },
  { key: 'families', icon: 'chatbubbles-outline' },
  { key: 'calendar', icon: 'calendar-outline' },
];

/**
 * The welcome to List your business (Fezy, 2026-11-10: "luxurious, classy,
 * minimal"): a mehndi artist at work, full screen, the same loop as the
 * business page of "What brings you to Wedded?", with three plain promises
 * and one white pill. Get started asks three questions and makes their page;
 * someone who'd rather talk to us leaves their number instead. A person who
 * already runs a business here gets Open my business, one tap to that side.
 * Always white words over the video, in light and dark mode.
 */
export function BusinessWelcome() {
  const Colors = useColors();
  const styles = useStyles();
  const scheme = useScheme();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const { status, requireSignIn } = useSession();
  const { isVendor } = useIsVendor();

  // White clock and battery over the video; the app's own on the way out
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle(scheme === 'dark' ? 'light' : 'dark');
    }, [scheme]),
  );

  const start = () => router.push('/for-vendors/name');

  return (
    <View style={styles.root}>
      <Clip video={VIDEO} poster={POSTER} active />
      <View style={[StyleSheet.absoluteFill, styles.dim]} />
      <View style={[styles.topShade, backgroundCss(TOP_SHADE)]} />
      <View style={[styles.bottomShade, backgroundCss(BOTTOM_SHADE)]} />

      <ScrollView
        style={StyleSheet.absoluteFill}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 72, paddingBottom: insets.bottom + Spacing.sm },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.words}>
          <AppText variant="label" weight={600} color="onPhoto" style={styles.kicker}>
            {t('vendorJoin.kicker')}
          </AppText>
          <AppText
            variant="display"
            weight={700}
            color="onPhoto"
            accessibilityRole="header"
            style={styles.title}
          >
            {t('vendorJoin.title')}
          </AppText>
          <AppText variant="bodyLg" color="onPhoto" style={styles.soft}>
            {t('vendorJoin.body')}
          </AppText>
        </View>

        <View style={styles.promises}>
          {PROMISES.map(({ key, icon }, index) => (
            <View
              key={key}
              style={[styles.promise, index > 0 && styles.divider]}
              accessible
              accessibilityLabel={`${t(`vendorJoin.promises.${key}.title`)}. ${t(`vendorJoin.promises.${key}.body`)}`}
            >
              <Icon name={icon} size={24} color={Colors.onPhoto} />
              <View style={styles.grow}>
                <AppText weight={700} color="onPhoto">
                  {t(`vendorJoin.promises.${key}.title`)}
                </AppText>
                <AppText variant="label" weight={400} color="onPhoto" style={styles.soft}>
                  {t(`vendorJoin.promises.${key}.body`)}
                </AppText>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <PressableScale
            accessibilityRole="button"
            onPress={() => {
              selectionHaptic();
              if (isVendor) switchToBusiness();
              else start();
            }}
            style={styles.pill}
          >
            <AppText variant="button" weight={700} style={styles.pillText}>
              {isVendor ? t('vendorJoin.open') : t('vendorJoin.start')}
            </AppText>
          </PressableScale>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              selectionHaptic();
              if (isVendor) start();
              else router.push('/for-vendors/call-me');
            }}
            style={({ pressed }) => [styles.link, pressed && styles.pressed]}
          >
            <AppText variant="label" weight={600} color="onPhoto" style={styles.center}>
              {isVendor ? t('vendorJoin.another') : t('vendorJoin.callMe')}
            </AppText>
          </Pressable>
        </View>
      </ScrollView>

      <View
        style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}
        pointerEvents="box-none"
      >
        <GlassButton
          icon="chevron-back"
          color={Colors.onPhoto}
          accessibilityLabel={t('common.back')}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          size={44}
        />
        {status === 'signedOut' && (
          <Pressable
            accessibilityRole="button"
            hitSlop={12}
            onPress={() => {
              selectionHaptic();
              requireSignIn(undefined, { joinAs: 'business' });
            }}
            style={({ pressed }) => [styles.signIn, pressed && styles.pressed]}
          >
            <AppText weight={600} color="onPhoto">
              {t('vendorJoin.signIn')}
            </AppText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

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
    height: 180,
  },
  bottomShade: {
    pointerEvents: 'none',
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '72%',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    gap: Spacing.xl,
    paddingHorizontal: Sizes.pageGutter + Spacing.xs,
  },
  words: {
    gap: Spacing.sm,
  },
  kicker: {
    opacity: 0.85,
  },
  title: {
    letterSpacing: -0.5,
  },
  soft: {
    opacity: 0.85,
  },
  grow: {
    flex: 1,
    gap: 2,
  },
  promises: {
    marginTop: -Spacing.xs,
  },
  promise: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.28)',
  },
  actions: {
    gap: Spacing.xs,
  },
  pill: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.button,
    borderCurve: 'continuous',
    // White with black words in both modes: it sits on the video
    backgroundColor: Colors.onPhoto,
  },
  pillText: {
    color: Colors.viewer,
  },
  link: {
    minHeight: Sizes.tapTarget,
    justifyContent: 'center',
  },
  center: {
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Sizes.pageGutter,
  },
  signIn: {
    minHeight: Sizes.tapTarget,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
  },
}));
