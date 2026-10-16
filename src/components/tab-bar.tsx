import { Image, type ImageProps } from 'expo-image';
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
import { Keyboard, Platform, Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Glass } from '@/components/glass';
import { Icon, type IconName } from '@/components/icon';
import {
  type ColorToken,
  makeStyles,
  Palettes,
  Sizes,
  Spacing,
  Springs,
  useColors,
} from '@/constants/theme';

export type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

export type TabSpec = {
  name: string;
  label: string;
  icon?: IconName;
  iconFilled?: IconName;
  /** A one-colour picture instead of an icon (Wed's ribbon), tinted like the
   * icons: a require()'d PNG, drawn 28 by 24. */
  image?: ImageProps['source'];
  /** A count on the icon, e.g. unread messages on Profile. */
  badge?: number;
  /** What a screen reader says for the count, e.g. "1 needs your OK". */
  badgeLabel?: string;
};

const PADDING = 6;

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
 * useBottomSpace it leaves no room for Wed's floating button, which isn't
 * shown over Reels.
 */
export function useTabBarTop() {
  const inTabs = useContext(TabBarSpaceContext) > 0;
  const insets = useSafeAreaInsets();
  const offset = useTabBarOffset();
  return inTabs ? Sizes.tabBar + offset : insets.bottom;
}

/**
 * The iOS 26 tab bar: a glass capsule floating over the content, with a
 * highlight that springs to the selected tab. Labels are always visible and
 * at least 13 point (vision §5); the selected tab also gets its filled icon
 * (a picture tab grows a little instead) and the highlight, so colour isn't
 * the only signal. Slides away while a screen asks with useHideTabBar().
 */
export function GlassTabBar({
  state,
  descriptors,
  navigation,
  tabs,
  accent = 'primary',
  floating,
}: TabBarProps & {
  tabs: TabSpec[];
  /** The selected tab's colour: saffron in business mode, so it's clear which side this is. */
  accent?: ColorToken;
  /**
   * A round button floating just above the bar's right end (Wed's), which
   * hides with the bar. It's left out over Reels' videos, whose own buttons
   * sit there, and on a route the bar has no tab for (the one it opens).
   */
  floating?: ReactNode;
}) {
  const appColors = useColors();
  const styles = useStyles();
  const bottom = useTabBarOffset();
  // Over the Reels videos the bar is always dark glass with light labels
  const overVideo = ['discover', 'reels'].includes(state.routes[state.index]?.name ?? '');
  const Colors = overVideo ? Palettes.dark : appColors;
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  // Routes without a tab (Wed, opened by the floating button) stay off the bar
  const shown = state.routes.filter((route) => tabs.some((tab) => tab.name === route.name));
  const selected = shown.findIndex((route) => route.key === state.routes[state.index]?.key);
  const itemWidth = width > 0 ? (width - PADDING * 2) / shown.length : 0;
  const x = useSharedValue(0);
  const keyboardShown = useKeyboardShown();
  const hidden = useSyncExternalStore(subscribeHidden, isHidden, neverHidden);
  const drop = useSharedValue(0);

  useEffect(() => {
    const target = Math.max(selected, 0) * itemWidth;
    x.value = reduceMotion || itemWidth === 0 ? target : withSpring(target, Springs.snappy);
  }, [selected, itemWidth, reduceMotion, x]);

  // Below the bottom edge, shadow and all
  useEffect(() => {
    const target = hidden ? Sizes.tabBar + bottom + Spacing.xl : 0;
    drop.value = reduceMotion ? target : withSpring(target, Springs.smooth);
  }, [hidden, bottom, reduceMotion, drop]);

  const highlight = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const dropStyle = useAnimatedStyle(() => ({ transform: [{ translateY: drop.value }] }));

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
        {floating && !overVideo && selected >= 0 && (
          <View style={[styles.floating, styles.through]}>{floating}</View>
        )}
        <Glass interactive scheme={overVideo ? 'dark' : undefined} style={styles.bar}>
          <View
            style={styles.items}
            accessibilityRole="tablist"
            onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
          >
            {itemWidth > 0 && selected >= 0 && (
              <Animated.View
                style={[
                  styles.highlight,
                  { width: itemWidth, backgroundColor: Colors.fillPressed },
                  highlight,
                ]}
              />
            )}
            {shown.map((route, index) => {
              const focused = selected === index;
              const spec = tabs.find((tab) => tab.name === route.name);
              const label = spec?.label ?? descriptors[route.key].options.title ?? route.name;
              const color = focused ? Colors[accent] : Colors.text;

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
                  accessibilityState={{ selected: focused }}
                  accessibilityLabel={
                    spec?.badge ? `${label}, ${spec.badgeLabel ?? spec.badge}` : label
                  }
                  onPress={onPress}
                  onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
                  style={styles.item}
                >
                  {spec && (
                    <View>
                      {spec.image ? (
                        <TabImage source={spec.image} color={color} focused={focused} />
                      ) : (
                        <Icon
                          name={(focused ? spec.iconFilled : spec.icon) ?? spec.icon ?? 'ellipse'}
                          size={Sizes.tabIcon}
                          color={color}
                          weight={focused ? 'semibold' : 'regular'}
                        />
                      )}
                      {!!spec.badge && (
                        <View style={[styles.badge, !!spec.image && styles.badgeOnImage]}>
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
                  )}
                  <AppText
                    variant="caption"
                    weight={600}
                    numberOfLines={1}
                    maxFontSizeMultiplier={1.2}
                    style={{ color }}
                  >
                    {label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </Glass>
      </Animated.View>
    </View>
  );
}

const IMAGE_SIZE = { width: 28, height: 24 };

/**
 * A picture tab (Wed's ribbon): one flat colour tinted like the icons, that
 * springs a little bigger while its tab is selected. It stays still with
 * Reduce Motion, where the highlight alone marks it.
 */
function TabImage({
  source,
  color,
  focused,
}: {
  source: ImageProps['source'];
  color: string;
  focused: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);

  useEffect(() => {
    const target = focused && !reduceMotion ? 1.08 : 1;
    scale.value = reduceMotion ? target : withSpring(target, Springs.snappy);
  }, [focused, reduceMotion, scale]);

  const grow = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={grow}>
      <Image
        source={source}
        tintColor={color}
        contentFit="contain"
        style={IMAGE_SIZE}
        accessible={false}
      />
    </Animated.View>
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
  floating: {
    alignItems: 'flex-end',
    marginBottom: Spacing.md,
  },
  gone: {
    pointerEvents: 'none',
  },
  bar: {
    height: Sizes.tabBar,
    borderRadius: Sizes.tabBar / 2,
  },
  items: {
    flex: 1,
    flexDirection: 'row',
    padding: PADDING,
  },
  highlight: {
    pointerEvents: 'none',
    position: 'absolute',
    top: PADDING,
    bottom: PADDING,
    left: PADDING,
    borderRadius: (Sizes.tabBar - PADDING * 2) / 2,
    backgroundColor: Colors.fillPressed,
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
    borderColor: Colors.surface,
  },
  // Clear of the ribbon's right loop, so the mark never looks clipped
  badgeOnImage: {
    top: -9,
    right: -18,
  },
  badgeText: {
    fontSize: 11,
    lineHeight: 14,
  },
  item: {
    flex: 1,
    minHeight: Sizes.tapTarget,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
}));
