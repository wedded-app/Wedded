import type { Tabs } from 'expo-router';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { Keyboard, Platform, Pressable, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Glass } from '@/components/glass';
import { Icon, type IconName } from '@/components/icon';
import {
  makeStyles,
  Palettes,
  Sizes,
  Spacing,
  Springs,
  useColors,
  useScheme,
} from '@/constants/theme';

export type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

export type TabSpec = {
  name: string;
  label: string;
  icon: IconName;
  iconFilled?: IconName;
  /** A count on the icon, e.g. unread messages on Profile. */
  badge?: number;
  /** Routes without a tab that count as this one, e.g. Search opened from Home. */
  alsoFor?: string[];
};

// Between the bar's edge and the tabs; each tab (and the lens behind the
// selected one) fills the bar's height inside it
const PADDING = 6;
const ITEM = Sizes.tabBar - PADDING * 2;
const LENS_FADE_MS = 160;
// Tabs whose pages are always dark (the Reels videos, Requests' night page)
const ALWAYS_DARK = ['discover', 'reels', 'requests'];

// Screens that cover the whole page for a moment (Wed's side menu) slide the
// bar away while they're open. A count, so two of them can't fight.
let hiders = 0;
const hideListeners = new Set<() => void>();
function subscribeHidden(listener: () => void) {
  hideListeners.add(listener);
  return () => {
    hideListeners.delete(listener);
  };
}
const isHidden = () => hiders > 0;
const neverHidden = () => false;

/**
 * Slides the floating tab bar down out of sight while `hide` is true, e.g.
 * while a full-height side menu is open over a tab. It comes back when
 * `hide` turns false or the screen unmounts.
 */
export function useHideTabBar(hide: boolean) {
  useEffect(() => {
    if (!hide) return;
    hiders += 1;
    hideListeners.forEach((listener) => listener());
    return () => {
      hiders -= 1;
      hideListeners.forEach((listener) => listener());
    };
  }, [hide]);
}

/** How far the floating tab bar sits above the bottom edge. */
export function useTabBarOffset() {
  const insets = useSafeAreaInsets();
  // Level with where iOS 26 floats its tab bar: just above the home indicator.
  return Math.max(insets.bottom - 12, Spacing.md);
}

// The space a screen inside the tabs leaves at the bottom of its scroll
// content so the last row can scroll clear of the floating bar. Zero outside
// the tabs (the vendor profile, sheets).
const TabBarSpaceContext = createContext(0);
export const TabBarSpaceProvider = TabBarSpaceContext.Provider;

/** Bottom padding for a scroll view: clears the floating tab bar, or the home indicator. */
export function useBottomSpace() {
  const tabBarSpace = useContext(TabBarSpaceContext);
  const insets = useSafeAreaInsets();
  return Math.max(tabBarSpace, insets.bottom) + Spacing.xl;
}

/**
 * How far the floating tab bar's top edge sits above the bottom of the
 * screen, or the home indicator's outside the tabs: for full-screen media
 * like Reels, whose words and progress line sit right on it.
 */
export function useTabBarTop() {
  const inTabs = useContext(TabBarSpaceContext) > 0;
  const insets = useSafeAreaInsets();
  const offset = useTabBarOffset();
  return inTabs ? Sizes.tabBar + offset : insets.bottom;
}

/**
 * The bottom bar, in iOS 26's style: a Liquid Glass capsule floating over the
 * content (TabBarSpaceProvider leaves room for it), every tab its icon with
 * its name under it, and a solid ink lens behind the selected one that springs
 * from tab to tab. The selected tab's icon fills in and turns white on the
 * lens; the others stay outlined and grey. `center` (Wed's button) takes
 * the middle slot between two halves of tabs, level with them, and the lens
 * sits behind it while `centerFor` is open. Over Reels the glass is always
 * dark. Slides away while a screen asks with useHideTabBar().
 */
export function TabBar({
  state,
  navigation,
  tabs,
  accent = 'text',
  center,
  centerFor,
}: TabBarProps & {
  tabs: TabSpec[];
  /** The selected tab's colour: black (white in dark mode), or saffron in business mode, so it's clear which side this is. */
  accent?: 'text' | 'kesari';
  center?: ReactNode;
  /** The route the middle button opens: while it's open the lens sits behind the button. */
  centerFor?: string;
}) {
  const appColors = useColors();
  const scheme = useScheme();
  const styles = useStyles();
  const bottom = useTabBarOffset();
  const reduceMotion = useReducedMotion();
  const focused = state.routes[state.index];
  const current = focused?.name ?? '';
  // The page on top of a tab's own stack, e.g. Requests on the Vendors tab
  const inner = focused?.state?.routes[focused.state.index ?? 0]?.name ?? '';
  // Over the Reels videos and Requests' night page the bar is always dark glass
  const overDark = ALWAYS_DARK.includes(current) || ALWAYS_DARK.includes(inner);
  const Colors = overDark ? Palettes.dark : appColors;
  const tint = accent === 'kesari' ? Colors.kesari : Colors.text;
  // Only the routes with a tab: a hidden route (href: null, like Wed) gets no slot
  const shown = state.routes.filter((route) => tabs.some((tab) => tab.name === route.name));
  const half = center ? Math.ceil(shown.length / 2) : shown.length;
  const keyboardShown = useKeyboardShown();
  const hidden = useSyncExternalStore(subscribeHidden, isHidden, neverHidden);
  const drop = useSharedValue(0);
  const [rowWidth, setRowWidth] = useState(0);

  const isSelected = (route: (typeof shown)[number]) =>
    route.name === current ||
    !!tabs.find((tab) => tab.name === route.name)?.alsoFor?.includes(current);

  // Equal slots in screen order: the first half, the middle button, the rest
  const slots = shown.length + (center ? 1 : 0);
  const slotWidth = rowWidth > 0 ? rowWidth / slots : 0;
  const selectedAt = shown.findIndex(isSelected);
  const lensSlot =
    selectedAt >= 0
      ? selectedAt + (center && selectedAt >= half ? 1 : 0)
      : center && centerFor === current
        ? half
        : -1;

  const lensX = useSharedValue(0);
  const lensOpacity = useSharedValue(0);
  const lensPlaced = useRef(false);
  useEffect(() => {
    if (lensSlot < 0 || slotWidth === 0) {
      lensOpacity.value = withTiming(0, { duration: LENS_FADE_MS });
      return;
    }
    const x = PADDING + lensSlot * slotWidth;
    // The first time it appears where it belongs; after that it slides
    if (!lensPlaced.current || reduceMotion) {
      lensX.value = x;
      lensPlaced.current = true;
    } else {
      lensX.value = withSpring(x, Springs.smooth);
    }
    lensOpacity.value = withTiming(1, { duration: LENS_FADE_MS });
  }, [lensSlot, slotWidth, reduceMotion, lensX, lensOpacity]);

  // Below the bottom edge, shadow and all
  useEffect(() => {
    const target = hidden ? Sizes.tabBar + bottom + Spacing.xl : 0;
    drop.value = reduceMotion ? target : withSpring(target, Springs.smooth);
  }, [hidden, bottom, reduceMotion, drop]);

  const dropStyle = useAnimatedStyle(() => ({ transform: [{ translateY: drop.value }] }));
  const lensStyle = useAnimatedStyle(() => ({
    opacity: lensOpacity.value,
    transform: [{ translateX: lensX.value }],
  }));

  // Android lifts the whole screen above the keyboard; the bar would ride on it.
  if (keyboardShown) return null;

  // Whether it takes taps sits on a plain View, as one of two stylesheet
  // styles that swap. On the web an inline 'box-none' isn't valid CSS, so the
  // browser would keep an earlier inline 'none' (and Reanimated's web style
  // writer never removes a key that drops out of an animated view's style):
  // either way a bar hidden once would stay untappable.
  return (
    <View
      style={[styles.wrap, { bottom }, hidden ? styles.gone : styles.through]}
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
    >
      <Animated.View style={[styles.through, dropStyle]}>
        <Glass scheme={overDark ? 'dark' : scheme} style={styles.bar} />
        <Animated.View
          style={[styles.lens, { width: slotWidth, backgroundColor: tint }, lensStyle]}
        />
        <View
          style={styles.items}
          accessibilityRole="tablist"
          onLayout={(event: LayoutChangeEvent) =>
            setRowWidth(event.nativeEvent.layout.width - PADDING * 2)
          }
        >
          {shown.slice(0, half).map(renderTab)}
          {center ? <View style={styles.slot}>{center}</View> : null}
          {shown.slice(half).map(renderTab)}
        </View>
      </Animated.View>
    </View>
  );

  function renderTab(route: (typeof shown)[number]) {
    const focused = route.name === current;
    const spec = tabs.find((tab) => tab.name === route.name)!;
    const selected = isSelected(route);
    const color = selected ? Colors.surface : Colors.text2;

    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      if (!focused && !event.defaultPrevented) {
        navigation.navigate(route.name, route.params);
      }
    };

    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected }}
        accessibilityLabel={spec.badge ? `${spec.label}, ${spec.badge}` : spec.label}
        onPress={onPress}
        onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
        style={({ pressed }) => [styles.slot, pressed && !selected && styles.pressed]}
      >
        <View>
          <Icon
            name={(selected ? spec.iconFilled : spec.icon) ?? spec.icon}
            size={Sizes.tabIcon}
            color={color}
            weight={selected ? 'semibold' : 'regular'}
          />
          {!!spec.badge && (
            <View style={[styles.badge, { borderColor: Colors.surface }]}>
              <AppText
                variant="caption"
                weight={700}
                color="onPrimary"
                maxFontSizeMultiplier={1.2}
                style={styles.badgeText}
              >
                {spec.badge > 99 ? '99+' : String(spec.badge)}
              </AppText>
            </View>
          )}
        </View>
        <AppText
          variant="caption"
          weight={selected ? 600 : 500}
          numberOfLines={1}
          maxFontSizeMultiplier={1.2}
          // Settings' Extra large text scales past maxFontSizeMultiplier: shrink rather than cut "Requests"
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          style={[styles.label, { color }]}
        >
          {spec.label}
        </AppText>
      </Pressable>
    );
  }
}

function useKeyboardShown() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', () => setShown(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setShown(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return shown;
}

const useStyles = makeStyles((Colors) => ({
  wrap: {
    position: 'absolute',
    left: Sizes.tabBarInset,
    right: Sizes.tabBarInset,
  },
  through: {
    pointerEvents: 'box-none',
  },
  gone: {
    pointerEvents: 'none',
  },
  // The glass behind the row
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: Sizes.tabBar,
    borderRadius: Sizes.tabBar / 2,
    borderCurve: 'continuous',
  },
  // The soft pill behind the selected tab; it slides with translateX
  lens: {
    position: 'absolute',
    left: 0,
    top: PADDING,
    height: ITEM,
    borderRadius: ITEM / 2,
    borderCurve: 'continuous',
    pointerEvents: 'none',
  },
  items: {
    height: Sizes.tabBar,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PADDING,
  },
  slot: {
    flex: 1,
    height: ITEM,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  pressed: {
    opacity: 0.55,
  },
  label: {
    maxWidth: '100%',
    paddingHorizontal: 2,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -12,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: Colors.errorFill,
    borderWidth: 2,
  },
  badgeText: {
    fontSize: 11,
    lineHeight: 14,
  },
}));
