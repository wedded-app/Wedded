import type { Tabs } from 'expo-router';
import {
  createContext,
  useContext,
  useEffect,
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
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
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
import { Motion } from '@/lib/motion';

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

const PADDING = 6;
// The selected pill around its name: side padding, the icon and the gap between them
const PILL_PADDING = 12;
const ICON_GAP = Spacing.xs + 2;
// A few points spare: text measures a fraction differently from how it's drawn
const PILL_CHROME = PILL_PADDING * 2 + Sizes.tabIcon + ICON_GAP + 4;
// An icon-only tab never gets narrower than this
const MIN_ICON = 44;

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
 * like Reels, whose words and progress line sit right on it. Unlike
 * useBottomSpace it leaves no room for Wed's raised button, which sits
 * flat in the bar over Reels.
 */
export function useTabBarTop() {
  const inTabs = useContext(TabBarSpaceContext) > 0;
  const insets = useSafeAreaInsets();
  const offset = useTabBarOffset();
  return inTabs ? Sizes.tabBar + offset : insets.bottom;
}

/** The round button in the middle of the bar (Wed's) and the ring around it. */
const CENTER = 60;
const RING = CENTER + 8;
// Its slot in the row: the ring and a little air either side, so a pill never touches it
const CENTER_SLOT = RING + Spacing.sm;
/** How far the middle button rises above the bar, for content to clear. */
export const CENTER_RISE = 26;

/**
 * The bottom bar: a solid capsule floating over the content. The selected
 * tab grows into a filled pill with its icon and name; the others show just
 * their icon (screen readers still hear every name). `center` (Wed's button)
 * sits raised in the middle, between two equal halves of tabs, and stays put
 * as the pill moves: the pill grows inside its half. Only on a phone too
 * narrow for a name like Requests beside it does that half take the room the
 * name needs, so a name is never cut short. Over Reels it sits flat in the
 * bar, clear of the video's words. Slides away while a screen asks with
 * useHideTabBar().
 */
export function TabBar({
  state,
  descriptors,
  navigation,
  tabs,
  accent = 'primary',
  center,
}: TabBarProps & {
  tabs: TabSpec[];
  /** The selected pill's colour: saffron in business mode, so it's clear which side this is. */
  accent?: 'primary' | 'kesari';
  center?: ReactNode;
}) {
  const appColors = useColors();
  const scheme = useScheme();
  const styles = useStyles();
  const bottom = useTabBarOffset();
  const current = state.routes[state.index]?.name ?? '';
  // Over the Reels videos the bar is always dark, with the button lowered into it
  const overVideo = ['discover', 'reels'].includes(current);
  const Colors = overVideo ? Palettes.dark : appColors;
  const dark = overVideo || scheme === 'dark';
  const fill = accent === 'primary' ? Colors.primaryFill : Colors.kesari;
  // White on the fill, except on dark mode's light saffron, which needs dark words
  const onFill = dark && accent === 'kesari' ? Colors.bg : Colors.onPrimary;
  const reduceMotion = useReducedMotion();
  // Only the routes with a tab: a hidden route (href: null, like Wed) gets no slot
  const shown = state.routes.filter((route) => tabs.some((tab) => tab.name === route.name));
  const half = Math.ceil(shown.length / 2);
  const keyboardShown = useKeyboardShown();
  const hidden = useSyncExternalStore(subscribeHidden, isHidden, neverHidden);
  const drop = useSharedValue(0);
  // The row's width and each name's width (measured off screen), to keep Wed in the middle
  const [rowWidth, setRowWidth] = useState(0);
  const [labelWidths, setLabelWidths] = useState<Record<string, number>>({});

  // Below the bottom edge, shadow and all
  useEffect(() => {
    const target = hidden ? Sizes.tabBar + bottom + CENTER_RISE + Spacing.xl : 0;
    drop.value = reduceMotion ? target : withSpring(target, Springs.smooth);
  }, [hidden, bottom, reduceMotion, drop]);

  const dropStyle = useAnimatedStyle(() => ({ transform: [{ translateY: drop.value }] }));

  // Android lifts the whole screen above the keyboard; the bar would ride on it.
  if (keyboardShown) return null;

  const raised = !!center && !overVideo;

  const labelOf = (route: (typeof shown)[number]) =>
    tabs.find((tab) => tab.name === route.name)?.label ??
    descriptors[route.key].options.title ??
    route.name;
  const isSelected = (route: (typeof shown)[number]) =>
    route.name === current ||
    !!tabs.find((tab) => tab.name === route.name)?.alsoFor?.includes(current);

  // Each half's width: equal, unless the selected name needs more than half
  let sides: [number, number] | null = null;
  if (center && rowWidth > 0) {
    const even = (rowWidth - PADDING * 2 - CENTER_SLOT) / 2;
    const at = shown.findIndex(isSelected);
    const name = at >= 0 ? labelWidths[shown[at].key] : undefined;
    const inLeft = at < half;
    const icons = (inLeft ? half : shown.length - half) - 1;
    const extra =
      name === undefined ? 0 : Math.max(0, PILL_CHROME + name + icons * MIN_ICON - even);
    sides = inLeft ? [even + extra, even - extra] : [even - extra, even + extra];
  }
  const sideStyle = (width: number | undefined) =>
    width === undefined ? [styles.side, styles.sideEven] : [styles.side, { width }];

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
        <View style={[styles.bar, { backgroundColor: Colors.surface }]} />
        {/* The row is tall enough to hold the raised button: Android only takes taps inside a view's bounds */}
        <View
          style={[styles.items, styles.through, raised && styles.roomAbove]}
          accessibilityRole="tablist"
          onLayout={(event: LayoutChangeEvent) => setRowWidth(event.nativeEvent.layout.width)}
        >
          {center ? (
            <>
              <Animated.View layout={Motion.layout} style={sideStyle(sides?.[0])}>
                {shown.slice(0, half).map(renderTab)}
              </Animated.View>
              <Animated.View
                layout={Motion.layout}
                style={[styles.centerSlot, raised ? styles.slotRaised : styles.slotFlat]}
              >
                <View
                  style={[
                    styles.ring,
                    { backgroundColor: Colors.surface },
                    !raised && styles.ringFlat,
                  ]}
                >
                  {center}
                </View>
              </Animated.View>
              <Animated.View layout={Motion.layout} style={sideStyle(sides?.[1])}>
                {shown.slice(half).map(renderTab)}
              </Animated.View>
            </>
          ) : (
            shown.map(renderTab)
          )}
        </View>
        {center && (
          <View
            style={styles.measure}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {shown.map((route) => (
              <AppText
                key={route.key}
                variant="caption"
                weight={700}
                numberOfLines={1}
                maxFontSizeMultiplier={1.2}
                onLayout={(event: LayoutChangeEvent) => {
                  const { width } = event.nativeEvent.layout;
                  setLabelWidths((all) =>
                    all[route.key] === width ? all : { ...all, [route.key]: width },
                  );
                }}
              >
                {labelOf(route)}
              </AppText>
            ))}
          </View>
        )}
      </Animated.View>
    </View>
  );

  function renderTab(route: (typeof shown)[number]) {
    const focused = route.name === current;
    const spec = tabs.find((tab) => tab.name === route.name)!;
    const selected = isSelected(route);
    const label = labelOf(route);
    const color = selected ? onFill : Colors.text2;

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

    const tab = (
      <Animated.View
        key={route.key}
        layout={Motion.layout}
        style={selected ? styles.slotWide : styles.slot}
      >
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected }}
          accessibilityLabel={spec.badge ? `${label}, ${spec.badge}` : label}
          onPress={onPress}
          onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
          style={({ pressed }) => [
            styles.item,
            selected && { backgroundColor: fill },
            pressed && !selected && styles.pressed,
          ]}
        >
          <View>
            <Icon
              name={(selected ? spec.iconFilled : spec.icon) ?? spec.icon}
              size={Sizes.tabIcon}
              color={color}
              weight={selected ? 'semibold' : 'regular'}
            />
            {!!spec.badge && (
              <View style={[styles.badge, { borderColor: selected ? fill : Colors.surface }]}>
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
          {selected && (
            <Animated.View entering={Motion.enter} style={styles.labelBox}>
              <AppText
                variant="caption"
                weight={700}
                numberOfLines={1}
                maxFontSizeMultiplier={1.2}
                style={{ color }}
              >
                {label}
              </AppText>
            </Animated.View>
          )}
        </Pressable>
      </Animated.View>
    );
    return tab;
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
  // The bar's background, behind a row that can be taller (the raised button)
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: Sizes.tabBar,
    borderRadius: Sizes.tabBar / 2,
    borderCurve: 'continuous',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.14), 0 0 0 0.5px rgba(0, 0, 0, 0.06)',
  },
  items: {
    height: Sizes.tabBar,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: PADDING,
    paddingBottom: PADDING,
  },
  roomAbove: {
    height: Sizes.tabBar + CENTER_RISE,
  },
  // Half the tabs, either side of the middle button
  side: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    alignSelf: 'stretch',
  },
  sideEven: {
    flex: 1,
  },
  // The names laid out once, unseen, to measure them
  measure: {
    position: 'absolute',
    left: 0,
    top: 0,
    alignItems: 'flex-start',
    opacity: 0,
    pointerEvents: 'none',
  },
  // Icons share the room the selected pill doesn't need
  slot: {
    flex: 1,
    minWidth: MIN_ICON,
  },
  // As wide as its icon and name, giving way only when there's no room
  slotWide: {
    flexShrink: 1,
  },
  item: {
    height: Sizes.tabBar - PADDING * 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: ICON_GAP,
    paddingHorizontal: PILL_PADDING,
    borderRadius: (Sizes.tabBar - PADDING * 2) / 2,
    borderCurve: 'continuous',
  },
  pressed: {
    backgroundColor: Colors.fillPressed,
  },
  labelBox: {
    flexShrink: 1,
  },
  centerSlot: {
    width: CENTER_SLOT,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  // Partly out of the bar, like a button set into it
  slotRaised: {
    justifyContent: 'flex-start',
  },
  slotFlat: {
    justifyContent: 'center',
  },
  ring: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Over Reels: smaller and inside the bar, clear of the video's words
  ringFlat: {
    transform: [{ scale: 0.82 }],
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
