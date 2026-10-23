import { router, useNavigation } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  SafeAreaInsetsContext,
  useSafeAreaFrame,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { makeStyles, Radius, Spacing, Timing, useColors } from '@/constants/theme';
import { useLocale } from '@/i18n/locale-context';
import { iosEasing } from '@/lib/motion';

import { CloseWedProvider } from './close-wed';

/**
 * Wed as a sheet in a browser, where the stack has no sheet of its own: the
 * root stack shows Wed's routes as a see-through modal over the tab or page
 * it opened from (src/app/_layout), and this draws the sheet on it. It
 * slides up from the bottom in 340 ms on iOS's curve and stops, over a dim
 * that fades in, with a little of the page showing above it like an iPhone
 * sheet; closing (the chevron, or a tap on the dim) slides it down in 260
 * and leaves the page as it was. With Reduce Motion it just appears and
 * goes. Opened by its address (a refresh on /wed), with nothing under it,
 * it's the whole page, and closing goes Home.
 */
export function WedSheet({ children }: { children: ReactNode }) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const frame = useSafeAreaFrame();
  const reduceMotion = useReducedMotion();
  // Over a tab or a page, or the only screen
  const [over] = useState(() => navigation.canGoBack());
  const slides = over && !reduceMotion;
  // 0 below the bottom edge, 1 in place
  const progress = useSharedValue(slides ? 0 : 1);
  const top = Math.max(insets.top, Spacing.lg) + Spacing.sm;
  const travel = frame.height - top;

  useEffect(() => {
    if (slides) progress.set(withTiming(1, { duration: Timing.page, easing: iosEasing }));
  }, [slides, progress]);

  const leave = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else router.replace('/');
  }, [navigation]);

  const close = useCallback(() => {
    if (!slides) {
      leave();
      return;
    }
    progress.set(
      withTiming(0, { duration: Timing.sheetOut, easing: iosEasing }, (finished) => {
        'worklet';
        if (finished) scheduleOnRN(leave);
      }),
    );
  }, [slides, leave, progress]);

  const dim = useAnimatedStyle(() => ({ opacity: progress.get() }));
  const slide = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.get()) * travel }],
  }));

  const content = <CloseWedProvider value={close}>{children}</CloseWedProvider>;
  if (!over) return content;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.scrim }, dim]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('wedSheet.close')}
          onPress={close}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View style={[styles.sheet, { top }, slide]}>
        {/* The sheet starts below the status bar: no top inset inside it */}
        <SafeAreaInsetsContext.Provider value={{ ...insets, top: 0 }}>
          {content}
        </SafeAreaInsetsContext.Provider>
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    borderCurve: 'continuous',
    backgroundColor: Colors.canvas,
  },
}));
