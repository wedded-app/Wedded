import { type Tabs, useSegments } from 'expo-router';
import type { SFSymbol } from 'expo-symbols';
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
import {
  GestureDetector,
  GestureHandlerRootView,
  useCompetingGestures,
  usePanGesture,
} from 'react-native-gesture-handler';
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText } from '@/components/app-text';
import { Glass } from '@/components/glass';
import { Icon, type IconName } from '@/components/icon';
import {
  makeStyles,
  Palettes,
  Sizes,
  Spacing,
  Springs,
  Timing,
  useColors,
  useScheme,
} from '@/constants/theme';
import { selectionHaptic } from '@/lib/haptics';
import { iosEasing } from '@/lib/motion';

export type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];
type Route = TabBarProps['state']['routes'][number];

export type TabSpec = {
  name: string;
  label: string;
  icon: IconName;
  iconFilled?: IconName;
  /** Draws the icon itself instead, for one SF Symbols doesn't have (the Wedding tab's rings). */
  renderIcon?: (color: string, selected: boolean) => ReactNode;
  /** A count on the icon, e.g. families waiting on Leads. */
  badge?: number;
  /** Routes without a tab that count as this one, e.g. Search opened from Home. */
  alsoFor?: string[];
  /** iPhone's own bar: the SF Symbol, outlined, and filled while the tab is selected. */
  sf?: { default: SFSymbol; selected: SFSymbol };
  /** iPhone's own bar: template images (tinted like the symbols), for a tab SF Symbols has nothing for. */
  png?: { default: number; selected: number };
};

/**
 * A button in the middle of the bar that looks like a tab (its icon over its
 * name) but opens something instead of switching tabs: Wed.
 */
export type TabAction = {
  /** Its route: an empty tab that never opens, since iPhone's own bar holds only tabs. */
  route: string;
  label: string;
  /** The icon on this bar, drawn in `color`. */
  renderIcon: (color: string) => ReactNode;
  /** The icon on iPhone's own bar, as a template image. */
  png: number;
  badge?: number;
  accessibilityLabel: string;
  onPress: () => void;
};

// Between the bar's edge and the tabs; each tab (and the lens behind the
// selected one) fills the bar's height inside it
const PADDING = 6;
const ITEM = Sizes.tabBar - PADDING * 2;
const LENS_FADE_MS = 160;
// How much bigger the lens grows under a finger (iOS 26's grows about a
// sixth), and the icon under it
const LIFT = 0.16;
const MAGNIFY = 0.12;
// A finger held this long lifts the lens without moving
const HOLD_MS = 300;
// A press arriving this soon after a slide is the slide's own lift-off
const AFTER_SLIDE_MS = 350;
// When a slide let go, and whether that was just now. Only touches call
// these, never a render
const now = () => Date.now();
const justSlid = (endedAt: number) => now() - endedAt < AFTER_SLIDE_MS;
// Tabs whose pages are always dark (the Reels videos, Requests' night page)
const ALWAYS_DARK = ['discover', 'reels', 'requests'];

// Screens that cover the whole page for a moment (a full-height side menu
// over a tab) slide the bar away while they're open. A count, so two of them
// can't fight.
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
 * `hide` turns false or the screen unmounts. Android and the web only.
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

/**
 * What a screen inside the tabs leaves at the bottom so its last row can
 * scroll clear of the tab bar: `space` under the floating bar drawn here, or
 * `native` under iOS's own bar, whose height is already in the safe area
 * (each native tab has its own). Null outside the tabs (the vendor profile,
 * sheets).
 */
export type TabBarSpace = { space: number } | { native: true };
const TabBarSpaceContext = createContext<TabBarSpace | null>(null);
export const TabBarSpaceProvider = TabBarSpaceContext.Provider;

/** Bottom padding for a scroll view: clears the tab bar, or the home indicator. */
export function useBottomSpace() {
  const tabBar = useContext(TabBarSpaceContext);
  const insets = useSafeAreaInsets();
  const space = tabBar && 'space' in tabBar ? tabBar.space : 0;
  return Math.max(space, insets.bottom) + Spacing.xl;
}

/**
 * How far the tab bar's top edge sits above the bottom of the screen, or
 * the home indicator's outside the tabs: for full-screen media like Reels,
 * whose words and progress line sit right on it.
 */
export function useTabBarTop() {
  const tabBar = useContext(TabBarSpaceContext);
  const insets = useSafeAreaInsets();
  const offset = useTabBarOffset();
  return tabBar && 'space' in tabBar ? Sizes.tabBar + offset : insets.bottom;
}

type Slot = { kind: 'tab'; route: Route } | { kind: 'action' };

/**
 * The bottom bar on Android and the web, drawn to match iOS 26's own (which
 * iPhone uses, src/components/app-tabs.tsx): a Liquid Glass capsule floating
 * over the content (TabBarSpaceProvider leaves room for it), every tab its
 * icon over its name in ink, and a soft grey lens behind the selected one,
 * whose icon fills in (saffron in business mode). A tap glides the lens to
 * the new tab, swelling a little on the way. Hold the bar, or slide along
 * it, and the lens lifts into a bigger glass bubble that follows the finger,
 * the icon under it grows, the phone ticks at each tab, and letting go
 * opens the tab under it. `action` (Wed) takes the middle slot, drawn like a
 * tab; what it opens slides up over the tab, so the lens stays on the tab.
 * Over Reels the glass is always dark. With Reduce Motion the lens moves
 * without growing. Slides away while a screen asks with useHideTabBar().
 */
export function TabBar({
  state,
  emitter,
  navigateToTab,
  tabs,
  accent = 'text',
  action,
}: TabBarProps & {
  tabs: TabSpec[];
  /** The selected tab's colour: ink, or saffron in business mode, so it's clear which side this is. */
  accent?: 'text' | 'kesari';
  action?: TabAction;
}) {
  const appColors = useColors();
  const scheme = useScheme();
  const styles = useStyles();
  const bottom = useTabBarOffset();
  const reduceMotion = useReducedMotion();
  const segments = useSegments();
  const focused = state.routes[state.index];
  const current = focused?.name ?? '';
  // The page on top of a tab's own stack, e.g. Requests on the Vendors tab
  const inner = segments[segments.length - 1] ?? '';
  // Over the Reels videos and Requests' night page the bar is always dark glass
  const overDark = ALWAYS_DARK.includes(current) || ALWAYS_DARK.includes(inner);
  const darkGlass = overDark || scheme === 'dark';
  const Colors = overDark ? Palettes.dark : appColors;
  const tint = accent === 'kesari' ? Colors.kesari : Colors.text;
  // Only the routes with a tab: a hidden route (href: null) gets no slot
  const shown = state.routes.filter((route) => tabs.some((tab) => tab.name === route.name));
  const half = action ? Math.ceil(shown.length / 2) : shown.length;
  const keyboardShown = useKeyboardShown();
  const hidden = useSyncExternalStore(subscribeHidden, isHidden, neverHidden);
  const drop = useSharedValue(0);
  const [rowWidth, setRowWidth] = useState(0);

  const isSelected = (route: Route) =>
    route.name === current ||
    !!tabs.find((tab) => tab.name === route.name)?.alsoFor?.includes(current);

  // Equal slots in screen order: the first half of the tabs, the action, the rest
  const slots: Slot[] = [
    ...shown.slice(0, half).map((route) => ({ kind: 'tab', route }) as const),
    ...(action ? [{ kind: 'action' } as const] : []),
    ...shown.slice(half).map((route) => ({ kind: 'tab', route }) as const),
  ];
  const count = slots.length;
  const slotWidth = rowWidth > 0 ? rowWidth / count : 0;
  const lensSlot = slots.findIndex((slot) => slot.kind === 'tab' && isSelected(slot.route));
  const actionAt = slots.findIndex((slot) => slot.kind === 'action');
  // Where the lens rests: behind the selected tab (none on a page off the bar)
  const restX = lensSlot >= 0 ? PADDING + lensSlot * slotWidth : -1;

  const lensX = useSharedValue(0);
  const lensOpacity = useSharedValue(0);
  // 0 resting, 1 lifted into a bubble under a finger
  const lift = useSharedValue(0);
  // The slot under the finger while it slides, or -1
  const hover = useSharedValue(-1);
  // Which of the two slide gestures is sliding (its handler tag), or -1: a
  // plain tap never slides, and the one that loses the race leaves it alone
  const slid = useSharedValue(-1);
  const lensPlaced = useRef(false);
  const sliding = useRef(false);
  const slideEnded = useRef(0);

  useEffect(() => {
    if (lensSlot < 0 || slotWidth === 0) {
      lensOpacity.set(withTiming(0, { duration: LENS_FADE_MS }));
      return;
    }
    const x = PADDING + lensSlot * slotWidth;
    // The first time it appears where it belongs; after that it glides
    if (!lensPlaced.current || reduceMotion) {
      lensX.set(x);
      lensPlaced.current = true;
    } else if (!sliding.current) {
      lensX.set(withSpring(x, Springs.smooth));
      // Swelling a little on its way, as iOS 26's does, unless a slide just put it there
      if (!justSlid(slideEnded.current)) {
        lift.set(
          withSequence(
            withTiming(0.45, { duration: Timing.press, easing: iosEasing }),
            withTiming(0, { duration: Timing.quick, easing: iosEasing }),
          ),
        );
      }
    }
    lensOpacity.set(withTiming(1, { duration: LENS_FADE_MS }));
  }, [lensSlot, slotWidth, reduceMotion, lensX, lensOpacity, lift]);

  // Below the bottom edge, shadow and all
  useEffect(() => {
    const target = hidden ? Sizes.tabBar + bottom + Spacing.xl : 0;
    drop.set(reduceMotion ? target : withSpring(target, Springs.smooth));
  }, [hidden, bottom, reduceMotion, drop]);

  const pressTab = (route: Route) => {
    const event = emitter.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });
    if (route.name !== current && !event.defaultPrevented) {
      navigateToTab(route.key);
    }
  };
  const choose = (index: number) => {
    const slot = slots[index];
    if (!slot) return;
    if (slot.kind === 'action') action?.onPress();
    else pressTab(slot.route);
  };
  // A tap; ignored while a slide is under way or has just let go, since the
  // slide picks the tab itself
  const tap = (index: number) => {
    if (sliding.current || justSlid(slideEnded.current)) return;
    choose(index);
  };
  const startSlide = () => {
    sliding.current = true;
  };
  const endSlide = (index: number) => {
    sliding.current = false;
    slideEnded.current = now();
    if (index >= 0) choose(index);
  };

  // Slides along the bar: straight away once the finger moves sideways, or
  // after a hold without moving. Both lift the lens and let go the same way.
  const slotAt = (x: number) => {
    'worklet';
    return Math.min(count - 1, Math.max(0, Math.floor((x - PADDING) / slotWidth)));
  };
  // The lens centred under the finger, kept inside the bar
  const lensAt = (x: number) => {
    'worklet';
    return Math.min(PADDING + (count - 1) * slotWidth, Math.max(PADDING, x - slotWidth / 2));
  };
  const onSlideStart = (event: { x: number; handlerTag: number }) => {
    'worklet';
    const x = lensAt(event.x);
    slid.set(event.handlerTag);
    hover.set(slotAt(event.x));
    lensX.set(reduceMotion ? x : withSpring(x, Springs.snappy));
    lensOpacity.set(withTiming(1, { duration: LENS_FADE_MS }));
    lift.set(reduceMotion ? 0 : withSpring(1, Springs.snappy));
    scheduleOnRN(startSlide);
    scheduleOnRN(selectionHaptic);
  };
  const onSlideMove = (event: { x: number }) => {
    'worklet';
    const at = slotAt(event.x);
    lensX.set(lensAt(event.x));
    if (at !== hover.get()) {
      hover.set(at);
      scheduleOnRN(selectionHaptic);
    }
  };
  const onSlideEnd = (event: { x: number; handlerTag: number; canceled: boolean }) => {
    'worklet';
    if (slid.get() !== event.handlerTag) return;
    slid.set(-1);
    hover.set(-1);
    lift.set(reduceMotion ? 0 : withSpring(0, Springs.smooth));
    const at = event.canceled ? -1 : slotAt(event.x);
    // Into the tab let go on; back to the selected tab after Wed or a cancel
    const x = at >= 0 && at !== actionAt ? PADDING + at * slotWidth : restX;
    if (x >= 0) lensX.set(reduceMotion ? x : withSpring(x, Springs.smooth));
    else lensOpacity.set(withTiming(0, { duration: LENS_FADE_MS }));
    scheduleOnRN(endSlide, at);
  };
  const slideNow = usePanGesture({
    enabled: slotWidth > 0,
    activeOffsetX: [-10, 10],
    failOffsetY: [-24, 24],
    onActivate: onSlideStart,
    onUpdate: onSlideMove,
    onFinalize: onSlideEnd,
  });
  const holdThenSlide = usePanGesture({
    enabled: slotWidth > 0,
    activateAfterLongPress: HOLD_MS,
    onActivate: onSlideStart,
    onUpdate: onSlideMove,
    onFinalize: onSlideEnd,
  });
  const slide = useCompetingGestures(slideNow, holdThenSlide);

  const dropStyle = useAnimatedStyle(() => ({ transform: [{ translateY: drop.get() }] }));
  const lensStyle = useAnimatedStyle(() => ({
    opacity: lensOpacity.get(),
    transform: [{ translateX: lensX.get() }, { scale: 1 + lift.get() * LIFT }],
  }));
  // Resting, the lens is a soft grey; lifted, it turns to clear glass
  const lensFill = useAnimatedStyle(() => ({ opacity: 1 - lift.get() }));
  const lensGlass = useAnimatedStyle(() => ({ opacity: lift.get() }));

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
      <GestureHandlerRootView style={styles.through}>
        <Animated.View style={[styles.through, dropStyle]}>
          <Glass scheme={overDark ? 'dark' : scheme} style={styles.bar} />
          <Animated.View style={[styles.lens, { width: slotWidth }, lensStyle]}>
            <Animated.View
              style={[styles.lensLayer, { backgroundColor: Colors.tabLens }, lensFill]}
            />
            <Animated.View
              style={[
                styles.lensLayer,
                darkGlass ? styles.glassDark : styles.glassLight,
                lensGlass,
              ]}
            />
          </Animated.View>
          <GestureDetector gesture={slide}>
            <Animated.View
              style={styles.items}
              accessibilityRole="tablist"
              onLayout={(event: LayoutChangeEvent) =>
                setRowWidth(event.nativeEvent.layout.width - PADDING * 2)
              }
            >
              {slots.map((slot, index) => {
                if (slot.kind === 'action') {
                  return (
                    action && (
                      <TabSlot
                        key="action"
                        index={index}
                        hover={hover}
                        lift={lift}
                        label={action.label}
                        icon={action.renderIcon(Colors.text)}
                        color={Colors.text}
                        selected={false}
                        badge={action.badge}
                        badgeBorder={Colors.surface}
                        role="button"
                        accessibilityLabel={action.accessibilityLabel}
                        onPress={() => tap(index)}
                      />
                    )
                  );
                }
                const spec = tabs.find((tab) => tab.name === slot.route.name)!;
                const selected = isSelected(slot.route);
                const color = selected ? tint : Colors.text;
                return (
                  <TabSlot
                    key={slot.route.key}
                    index={index}
                    hover={hover}
                    lift={lift}
                    label={spec.label}
                    icon={
                      spec.renderIcon ? (
                        spec.renderIcon(color, selected)
                      ) : (
                        <Icon
                          name={(selected ? spec.iconFilled : spec.icon) ?? spec.icon}
                          size={Sizes.tabIcon}
                          color={color}
                          weight={selected ? 'semibold' : 'regular'}
                        />
                      )
                    }
                    color={color}
                    selected={selected}
                    badge={spec.badge}
                    badgeBorder={Colors.surface}
                    role="tab"
                    accessibilityLabel={spec.badge ? `${spec.label}, ${spec.badge}` : spec.label}
                    onPress={() => tap(index)}
                  />
                );
              })}
            </Animated.View>
          </GestureDetector>
        </Animated.View>
      </GestureHandlerRootView>
    </View>
  );
}

/** One slot: the icon (with its count) over the name, growing while the lens is lifted over it. */
function TabSlot({
  index,
  hover,
  lift,
  label,
  icon,
  color,
  selected,
  badge,
  badgeBorder,
  role,
  accessibilityLabel,
  onPress,
}: {
  index: number;
  hover: SharedValue<number>;
  lift: SharedValue<number>;
  label: string;
  icon: ReactNode;
  color: string;
  selected: boolean;
  badge?: number;
  badgeBorder: string;
  role: 'tab' | 'button';
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const styles = useStyles();
  const magnify = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + (hover.get() === index ? lift.get() * MAGNIFY : 0) }],
  }));
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={role === 'tab' ? { selected } : undefined}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.slot, pressed && !selected && styles.pressed]}
    >
      <Animated.View style={[styles.slotInner, magnify]}>
        <View>
          {icon}
          {!!badge && (
            <View style={[styles.badge, { borderColor: badgeBorder }]}>
              <AppText
                variant="caption"
                weight={700}
                color="onPrimary"
                maxFontSizeMultiplier={1.2}
                style={styles.badgeText}
              >
                {badge > 99 ? '99+' : String(badge)}
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
          {label}
        </AppText>
      </Animated.View>
    </Pressable>
  );
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
  // The pill behind the selected tab; it slides with translateX and grows when lifted
  lens: {
    position: 'absolute',
    left: 0,
    top: PADDING,
    height: ITEM,
    pointerEvents: 'none',
  },
  lensLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: ITEM / 2,
    borderCurve: 'continuous',
  },
  // The lifted lens is clear glass: white light with a bright rim and a soft
  // shadow, the same over any page (iOS 26's bubble looks alike in both schemes)
  glassLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    boxShadow: '0 6px 18px rgba(0, 0, 0, 0.16)',
  },
  glassDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    boxShadow: '0 6px 18px rgba(0, 0, 0, 0.4)',
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
    justifyContent: 'center',
  },
  slotInner: {
    alignSelf: 'stretch',
    alignItems: 'center',
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
