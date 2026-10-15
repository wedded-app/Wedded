import type { ReactNode } from 'react';
import {
  Platform,
  View,
  type LayoutChangeEvent,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { BackButton, type BackFallback } from '@/components/back-button';
import { useBottomSpace } from '@/components/tab-bar';
import { makeStyles, Sizes, Spacing } from '@/constants/theme';

/**
 * Scroll tracking for a screen with a large title: pass `onScroll` to an
 * Animated scroll view (with scrollEventThrottle 16), `onTitleLayout` to the
 * LargeTitle, and the whole object to the NavBar.
 */
export function useNavScroll() {
  const scrollY = useSharedValue(0);
  // Scrolling past this shows the bar's backdrop and small title.
  const collapseAt = useSharedValue(56);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  /** For screens whose title isn't a LargeTitle: where the bar should switch. */
  const setCollapseAt = (offset: number) => {
    collapseAt.value = offset;
  };
  const onTitleLayout = (event: LayoutChangeEvent) =>
    setCollapseAt(event.nativeEvent.layout.height);
  return { scrollY, collapseAt, onScroll, onTitleLayout, setCollapseAt };
}

export type NavScroll = ReturnType<typeof useNavScroll>;

/** The top of the nav bar row: under the status bar, or a little way down
 * a browser page, which has none. */
function useBarTop() {
  return Math.max(useSafeAreaInsets().top, Spacing.sm);
}

/** Where scroll content starts: under the status bar and the nav bar row. */
export function useNavTop() {
  return useBarTop() + Sizes.navBar;
}

type NavBarProps = {
  scroll: NavScroll;
  /** The small centred title that appears once the large one scrolls away. */
  title?: string | null;
  /** Shows the glass Back button (Home, with nothing to go back to). */
  back?: boolean;
  /** Where Back goes with nothing to go back to, instead of Home. */
  backTo?: BackFallback;
  /** Glass buttons on the right, e.g. the language switch. */
  trailing?: ReactNode;
  /** A custom control on the left instead of Back. */
  leading?: ReactNode;
};

/**
 * The iOS 26 navigation bar: floating glass buttons over the content, and,
 * once the large title scrolls under it, a soft backdrop that fades the
 * content out and the title in small type. Sits on top of the screen.
 */
export function NavBar({ scroll, title, back = true, backTo, trailing, leading }: NavBarProps) {
  const styles = useStyles();
  const top = useBarTop();
  // Worklets may capture only the shared values, never the whole scroll
  // object: its onScroll handler can't be copied to the UI thread (iOS crash).
  const { scrollY, collapseAt } = scroll;

  const collapsed = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [collapseAt.value - 12, collapseAt.value + 4],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <View style={[styles.bar, { height: top + Sizes.navBar }]}>
      <Animated.View style={[styles.backdrop, collapsed]} />
      <View style={[styles.row, { marginTop: top }]}>
        <View style={styles.side}>
          {leading ?? (back ? <BackButton fallback={backTo} /> : null)}
        </View>
        {title ? (
          <Animated.View style={[styles.titleWrap, styles.noTouch, collapsed]}>
            <AppText
              variant="button"
              numberOfLines={1}
              maxFontSizeMultiplier={1.3}
              style={styles.title}
            >
              {title}
            </AppText>
          </Animated.View>
        ) : (
          <View style={styles.titleWrap} />
        )}
        <View style={[styles.side, styles.trailing]}>{trailing}</View>
      </View>
    </View>
  );
}

type LargeTitleProps = {
  scroll: NavScroll;
  title: string;
  /** A line of context under the title. */
  subtitle?: string | null;
  /** A small line above the title, e.g. "Saving to Jaago". */
  eyebrow?: string | null;
  style?: StyleProp<ViewStyle>;
};

/**
 * The 34-point large title at the top of a screen's scroll content. It grows
 * a little when pulled down, as on iOS, and hands over to the NavBar's small
 * title when it scrolls away.
 */
export function LargeTitle({ scroll, title, subtitle, eyebrow, style }: LargeTitleProps) {
  const styles = useStyles();
  const { scrollY } = scroll;
  const stretch = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(scrollY.value, [-120, 0], [1.08, 1], Extrapolation.CLAMP),
      },
    ],
  }));

  return (
    <Animated.View onLayout={scroll.onTitleLayout} style={[styles.largeTitle, stretch, style]}>
      {eyebrow ? (
        <AppText variant="label" weight={600} color="text2">
          {eyebrow}
        </AppText>
      ) : null}
      <AppText variant="display" accessibilityRole="header">
        {title}
      </AppText>
      {subtitle ? (
        <AppText variant="bodyLg" color="text2">
          {subtitle}
        </AppText>
      ) : null}
    </Animated.View>
  );
}

type NavScreenProps = Omit<ScrollViewProps, 'onScroll' | 'children'> & {
  title?: string | null;
  /** A shorter title for the bar once the large one scrolls away, when the large one won't fit beside the buttons. */
  navTitle?: string;
  subtitle?: string | null;
  eyebrow?: string | null;
  back?: boolean;
  /** Where Back goes with nothing to go back to, instead of Home. */
  backTo?: BackFallback;
  /** A custom control on the left instead of Back, e.g. business mode's label. */
  leading?: ReactNode;
  trailing?: ReactNode;
  children: ReactNode;
};

/**
 * A scrolling screen with a large title and the iOS 26 nav bar: the usual
 * shape of a page in this app. Content gets the page gutter and 24 points
 * between blocks, and scrolls clear of the tab bar or home indicator.
 */
export function NavScreen({
  title,
  navTitle,
  subtitle,
  eyebrow,
  back = true,
  backTo,
  leading,
  trailing,
  children,
  contentContainerStyle,
  ...rest
}: NavScreenProps) {
  const styles = useStyles();
  const scroll = useNavScroll();
  const top = useNavTop();
  const bottom = useBottomSpace();

  return (
    <View style={styles.screen}>
      <Animated.ScrollView
        onScroll={scroll.onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        {...rest}
        contentContainerStyle={[
          styles.content,
          { paddingTop: top, paddingBottom: bottom },
          contentContainerStyle,
        ]}
      >
        {title ? (
          <LargeTitle scroll={scroll} title={title} subtitle={subtitle} eyebrow={eyebrow} />
        ) : null}
        {children}
      </Animated.ScrollView>
      <NavBar
        scroll={scroll}
        title={navTitle ?? title}
        back={back}
        backTo={backTo}
        leading={leading}
        trailing={trailing}
      />
    </View>
  );
}

// The backdrop behind the bar: the page colour, solid under the status bar
// and fading out below the bar, like iOS 26's scroll edge effect. The web
// also blurs what's behind it.
const FADE = 20;
const backdropStyle = (scrollEdge: string) =>
  (Platform.OS === 'web'
    ? {
        backgroundImage: scrollEdge,
        backdropFilter: 'blur(12px) saturate(180%)',
        maskImage: 'linear-gradient(to bottom, #000 75%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, #000 75%, transparent 100%)',
      }
    : { experimental_backgroundImage: scrollEdge }) as ViewStyle;

const useStyles = makeStyles((Colors) => ({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  content: {
    gap: Spacing.xl,
    paddingHorizontal: Sizes.pageGutter,
  },
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    pointerEvents: 'box-none',
  },
  noTouch: {
    pointerEvents: 'none',
  },
  backdrop: {
    pointerEvents: 'none',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: -FADE,
    ...backdropStyle(Colors.scrollEdge),
  },
  row: {
    pointerEvents: 'box-none',
    height: Sizes.navBar,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Sizes.pageGutter,
    gap: Spacing.sm,
  },
  side: {
    pointerEvents: 'box-none',
    minWidth: 88,
    flexDirection: 'row',
    alignItems: 'center',
  },
  trailing: {
    justifyContent: 'flex-end',
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    textAlign: 'center',
  },
  largeTitle: {
    gap: 2,
    transformOrigin: 'left center',
  },
}));
