import { router, useIsFocused, useSegments } from 'expo-router';
import { useEffect, useEffectEvent } from 'react';
import { AccessibilityInfo, Pressable, View } from 'react-native';
import Animated, {
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Glass } from '@/components/glass';
import { Icon } from '@/components/icon';
import { useTabBarOffset } from '@/components/tab-bar';
import { makeStyles, Palettes, Sizes, Spacing, Springs, useColors } from '@/constants/theme';
import { useHomeEvents } from '@/data/reference';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

import {
  clearSavedToast as clearToast,
  useSavedToast,
  useSavedToastLift,
} from './saved-toast-store';

/**
 * After a save, a toast above the tab bar says where it went ("Saved to
 * Jaago · See list") for 8 seconds (time to read it and reach it), and a
 * tap opens Saved (or Wed's lists, for a save made in Wed): since Wed took
 * Saved's tab, this is how a family finds their list again. It rises from
 * behind the tab bar and sinks back (it simply appears with Reduce Motion),
 * and screen readers hear it. The tabs layout mounts one host, and a vendor's
 * page another over its sticky Save bar. A save made where no host is drawn
 * ("Save to which event?", a story) shows its toast once a host's screen is
 * back on top, if that's within a few seconds; each toast shows only once.
 */

const SHOW_MS = 8000;
// A save older than this when the tabs come back isn't news any more
const LATE_MS = 8000;
const HEIGHT = 52;

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** The event's name for a slug, or the words as given. */
function useWhere(where: string | null): string | null {
  const { data: sections } = useHomeEvents();
  if (!where) return null;
  const event = sections
    ?.flatMap((section) => section.events)
    .find((candidate) => candidate.slug === where);
  if (event) return localized(event.name);
  // An event outside the family's traditions: its slug in plain words
  if (SLUG.test(where)) {
    const words = where.replace(/-/g, ' ');
    return words.charAt(0).toUpperCase() + words.slice(1);
  }
  return where;
}

/**
 * Draws the toast when there is one and this host's screen is on top. In the
 * tabs layout it rises from behind the tab bar (or Wed's composer, which
 * sets setSavedToastLift); elsewhere pass `bottom`, the top edge of what it
 * rises from behind (a vendor page's sticky bar).
 */
export function SavedToastHost({ bottom }: { bottom?: number } = {}) {
  const current = useSavedToast();
  // False while a screen covers the tabs: the toast waits for them
  const focused = useIsFocused();
  const segments = useSegments();
  const offset = useTabBarOffset();
  const lift = useSavedToastLift();
  const reduceMotion = useReducedMotion();
  // 0 hidden behind the tab bar, 1 in place
  const shown = useSharedValue(0);
  const { t } = useLocale();
  const where = useWhere(current?.where ?? null);
  const text = where ? t('saved.toastTo', { where }) : t('saved.toast');
  const seeList = t('saved.seeList');
  // Screen readers hear it once as it shows, in its wording at the time
  const announce = useEffectEvent(() =>
    AccessibilityInfo.announceForAccessibility(`${text}. ${seeList}.`),
  );

  // Up from behind the tab bar, 8 seconds, then back down and gone
  useEffect(() => {
    if (!current || !focused) return;
    if (Date.now() - current.at > LATE_MS) {
      clearToast(current.id);
      return;
    }
    const { id } = current;
    shown.value = reduceMotion ? 1 : withSpring(1, Springs.smooth);
    announce();
    const timer = setTimeout(() => {
      if (reduceMotion) {
        shown.value = 0;
        clearToast(id);
        return;
      }
      shown.value = withTiming(0, { duration: 220 }, (finished) => {
        if (finished) runOnJS(clearToast)(id);
      });
    }, SHOW_MS);
    return () => {
      clearTimeout(timer);
      // Seen once is enough: it doesn't come back on the next screen
      clearToast(id);
      // A newer save rises in afresh, so it reads as news
      shown.value = 0;
    };
  }, [current, focused, reduceMotion, shown]);

  if (!current || !focused) return null;

  return (
    <ToastView
      text={text}
      seeList={seeList}
      hint={t('saved.seeListHint')}
      bottom={bottom ?? offset + Sizes.tabBar + lift}
      // Over the Reels videos the tab bar is dark glass; the toast matches it
      dark={segments[segments.length - 1] === 'discover'}
      shown={shown}
      onPress={() => {
        clearToast(current.id);
        router.navigate(current.href);
      }}
    />
  );
}

function ToastView({
  text,
  seeList,
  hint,
  bottom,
  dark,
  shown,
  onPress,
}: {
  text: string;
  /** "See list", and what it does for a screen reader. */
  seeList: string;
  hint: string;
  /** The tab bar's (or sticky bar's) top edge, from the bottom of the screen. */
  bottom: number;
  dark: boolean;
  shown: SharedValue<number>;
  onPress: () => void;
}) {
  const styles = useStyles();
  const appColors = useColors();
  const Colors = dark ? Palettes.dark : appColors;
  // From just under the clip edge (the tab bar's top) up into place
  const rise = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - shown.value) * (HEIGHT + Spacing.xl) }],
  }));

  return (
    <View style={[styles.clip, { bottom }]}>
      <Animated.View style={rise}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${text}. ${seeList}`}
          accessibilityHint={hint}
          accessibilityLiveRegion="polite"
          onPress={onPress}
        >
          {({ pressed }) => (
            <Glass interactive scheme={dark ? 'dark' : undefined} style={styles.toast}>
              <View style={[styles.inner, pressed && styles.pressed]}>
                <Icon name="heart" size={Sizes.iconSmall} color={Colors.primary} />
                <AppText
                  weight={600}
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.4}
                  style={[styles.words, { color: Colors.text }]}
                >
                  {text}
                </AppText>
                <AppText weight={600} maxFontSizeMultiplier={1.4} style={{ color: Colors.primary }}>
                  {seeList}
                </AppText>
              </View>
            </Glass>
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  // Clips the toast at the tab bar's top edge, so it seems to come out from
  // behind the bar. Room above and at the sides for the glass's shadow.
  clip: {
    pointerEvents: 'box-none',
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    overflow: 'hidden',
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
    paddingHorizontal: Sizes.tabBarInset,
  },
  toast: {
    minHeight: HEIGHT,
    maxWidth: 420,
    borderRadius: HEIGHT / 2,
    borderCurve: 'continuous',
  },
  inner: {
    minHeight: HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.lg + Spacing.xs,
  },
  words: {
    flexShrink: 1,
    marginRight: Spacing.sm,
  },
  pressed: {
    opacity: 0.6,
  },
}));
