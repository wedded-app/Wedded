import { useFocusEffect, useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import {
  Keyboard,
  Platform,
  ScrollView,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTabBarOffset } from '@/components/tab-bar';
import { backgroundCss, makeStyles, Sizes, Spacing, useColors } from '@/constants/theme';
import { SavedToastHost } from '@/features/saved/saved-toast';
import { Greeting } from '@/features/wed/chat/greeting';
import { ProgressChip } from '@/features/wed/chat/progress-chip';
import { ThreadRow } from '@/features/wed/chat/thread-row';
import { WedHeader } from '@/features/wed/chat/wed-header';
import { useCloseWed } from '@/features/wed/close-wed';
import { useKeyboardHeight } from '@/features/wed/keyboard-height';
import { WedComposer } from '@/features/wed/wed-composer';
import { useWedMenuShift, WedMenu } from '@/features/wed/wed-menu';
import {
  AWAY_LINE,
  getWed,
  useWed,
  wed,
  type ChatItem,
  type WedState,
} from '@/features/wed/wed-store';
import { Motion } from '@/lib/motion';

// The composer with one line of words, and the "About: …" chip above it,
// until it reports its real height
const COMPOSER = 56;
const CONTEXT_CHIP = 44 + Spacing.sm;
// Within this much of the end, new rows keep the thread scrolled to the end
const STICK_WITHIN = 96;
// The band at the top below the safe area: its buttons, one row of chips
// (40) and the gaps, until it reports its real height
const BAND = Sizes.tapTarget + Spacing.sm + 40 + Spacing.lg;

// Rows already brought up under the band ("While you were away", Look
// first's card, a tall card as it arrived), so each is placed once, not
// again every time the sheet opens
const placed = new Set<string>();

// The task running now (the newest), for the progress chip
const runningTask = (s: WedState) => {
  for (let i = s.tasks.length - 1; i >= 0; i--) {
    if (s.tasks[i].state === 'running') return s.tasks[i].id;
  }
  return null;
};
const hasContext = (s: WedState) => s.context !== null;

/**
 * Wed, the planning helper: one chat, like ChatGPT's, the first page of
 * Wed's sheet. The maroon band at the top (WedHeader) has the menu, the bow,
 * the chevron that closes the sheet, and how much Wed does; under it
 * yesterday's messages above today's greeting, and the family's words,
 * Wed's answers, its work, what it found and the cards waiting for a yes,
 * in one thread on the white page, which fades in as the sheet lands (it
 * just appears with Reduce Motion). The composer floats at the bottom of
 * the sheet; the menu at the top left opens Wed's pages. Everything comes
 * from the Wed store, so a flow keeps playing while the sheet is closed,
 * and a yes on Home shows here too. MOCKUP: scripted flows.
 *
 * The thread is a plain ScrollView that keeps to the end as rows arrive
 * (unless the family has scrolled up to read), not an inverted list, which
 * misbehaves on the web.
 */
export default function WedScreen() {
  const Colors = useColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const items = useWed((s) => s.items);
  const history = useWed((s) => s.history);
  const context = useWed(hasContext);
  const focus = useWed((s) => s.focus);
  const onTab = useWed((s) => s.onWedTab);
  const runningId = useWed(runningTask);
  const [menuOpen, setMenuOpen] = useState(false);
  const shift = useWedMenuShift(menuOpen);
  const keyboard = useKeyboardHeight();
  const close = useCloseWed();
  const focused = useIsFocused();

  // Where things sit: the composer at the bottom of the sheet, where iOS
  // floats its bars (there's no tab bar under it), and the thread between
  // the band and the composer
  const composerBottom = useTabBarOffset();
  const [composerHeight, setComposerHeight] = useState(0);
  const composerCover = composerHeight || COMPOSER + (context ? CONTEXT_CHIP : 0);
  const composerSpace = composerBottom + composerCover + Spacing.lg;
  const [headerHeight, setHeaderHeight] = useState(0);
  const headerTop = headerHeight || Math.max(insets.top, Spacing.md) + BAND;
  const [viewport, setViewport] = useState(0);

  // Rows that were there when the chat opened don't animate in
  const [initialKeys] = useState(() => new Set(getWed().items.map((item) => item.key)));
  const scroll = useRef<ScrollViewInstance>(null);
  const rows = useRef(new Map<string, { y: number; height: number }>());
  const metrics = useRef({ y: 0, viewport: 0, shown: false, sent: '' });
  // Keep to the end as rows arrive; off while the family reads further up
  const stick = useRef(getWed().focus === null);
  // The running work row's key while it's out of sight (the progress chip)
  const [offKey, setOffKey] = useState<string | null>(null);
  // A row to bring up under the band once it's really laid out: Look
  // first's card, "While you were away", or a card taller than the screen
  // as it arrives. Rows that arrive while a Wed page covers the chat report
  // a height of 0 until it shows again, so those wait.
  const anchor = useRef<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      wed.setOnWedTab(true);
      return () => wed.setOnWedTab(false);
    }, []),
  );

  const last = items[items.length - 1];

  const runningKey = runningId
    ? (items.find((item) => item.kind === 'work' && item.taskId === runningId)?.key ?? null)
    : null;

  const scrollToKey = (key: string) => {
    const row = rows.current.get(key);
    // Not laid out yet (or laid out while hidden)
    if (!row || row.height === 0) return false;
    scroll.current?.scrollTo({ y: Math.max(0, row.y - headerTop - Spacing.md), animated: true });
    return true;
  };

  const tryAnchor = () => {
    const key = anchor.current;
    if (!key || !getWed().onWedTab) return;
    if (scrollToKey(key)) anchor.current = null;
  };
  // From an effect: on the next frame, with this render's measurements
  const anchorSoon = useEffectEvent(() => {
    requestAnimationFrame(() => tryAnchor());
  });

  // Back after a vendor replied: start at "While you were away", not the end
  useEffect(() => {
    if (!onTab) return;
    const away = [...getWed().items]
      .reverse()
      .find((item) => item.kind === 'divider' && item.text === AWAY_LINE);
    if (!away || placed.has(away.key)) return;
    placed.add(away.key);
    anchor.current = away.key;
    stick.current = false;
    anchorSoon();
  }, [onTab]);

  // The chip shows while the running work row is above or below what's in view
  const checkChip = () => {
    const row = runningKey ? rows.current.get(runningKey) : undefined;
    const { y, viewport: height } = metrics.current;
    if (!runningKey || !row || height === 0) return;
    const above = row.y + row.height < y + headerTop + Spacing.sm;
    const below = row.y > y + height - composerSpace - Spacing.sm;
    setOffKey(above || below ? runningKey : null);
  };

  // Look first on Home: that card goes to the top once it's laid out
  useEffect(() => {
    if (!focus || !onTab) return;
    const target = getWed().items.find((item) => item.kind === 'approval' && item.id === focus);
    wed.setFocus(null);
    if (!target) return;
    anchor.current = target.key;
    stick.current = false;
    anchorSoon();
  }, [focus, onTab]);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const m = metrics.current;
    const fromEnd = contentSize.height - contentOffset.y - layoutMeasurement.height;
    if (fromEnd < STICK_WITHIN) stick.current = true;
    else if (contentOffset.y < m.y - 2) stick.current = false;
    m.y = contentOffset.y;
    checkChip();
  };

  const onContentSizeChange = () => {
    const m = metrics.current;
    // The family just sent something: back to the end to see the answer
    if (last?.kind === 'me' && last.key !== m.sent && !initialKeys.has(last.key)) {
      m.sent = last.key;
      stick.current = true;
    }
    if (anchor.current) tryAnchor();
    else if (stick.current) scroll.current?.scrollToEnd({ animated: m.shown });
    m.shown = true;
  };

  const onRowLayout = (key: string, event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    rows.current.set(key, { y, height });
    if (key === runningKey) checkChip();
    // A card that arrives taller than the space between the header and the
    // composer: show it from its top (what, who, what it shares), not from
    // its buttons
    const item = items.find((row) => row.key === key);
    const room = metrics.current.viewport - headerTop - composerSpace;
    if (
      item?.kind === 'approval' &&
      height > 0 &&
      !initialKeys.has(key) &&
      !placed.has(key) &&
      stick.current
    ) {
      placed.add(key);
      if (height > room) {
        anchor.current = key;
        stick.current = false;
      }
    }
    tryAnchor();
  };

  const openMenu = () => {
    Keyboard.dismiss();
    setMenuOpen(true);
  };
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  // Room under the last row for the keyboard, so it can scroll clear of it
  const keyboardSpace = useAnimatedStyle(() => ({
    height: Math.max(0, keyboard.value - composerBottom + Spacing.sm),
  }));
  // The bottom edge rides up with the composer
  const keyboardLift = useAnimatedStyle(() => ({
    transform: [{ translateY: -Math.max(0, keyboard.value + Spacing.sm - composerBottom) }],
  }));
  const chipShown = runningKey !== null && offKey === runningKey;

  const renderRow = (item: ChatItem) => {
    const fresh = !initialKeys.has(item.key);
    return (
      <Animated.View
        key={item.key}
        entering={fresh ? Motion.rise : undefined}
        layout={Motion.layout}
        onLayout={(event) => onRowLayout(item.key, event)}
      >
        <ThreadRow item={item} fresh={fresh} />
      </Animated.View>
    );
  };

  // An empty day: the greeting fills the screen down to the composer, with
  // yesterday just out of sight above it, and sits in the middle of what
  // the band leaves
  const emptyDay = items.length <= history;
  const greetingHeight = emptyDay && viewport > 0 ? viewport - composerSpace : undefined;

  return (
    <View style={styles.screen}>
      {/* Light over the band, which runs under the status bar on Android
          (on iPhone the sheet sets it); Wed's white pages get the app's own */}
      {Platform.OS === 'android' && focused ? <StatusBar style="light" /> : null}
      <Animated.View style={[styles.fill, shift]}>
        {/* The cards fade in as the sheet lands, once: not on the way back
            from a Wed page */}
        <Animated.View entering={Motion.land} style={styles.fill}>
          <ScrollView
            ref={scroll}
            style={styles.fill}
            contentContainerStyle={[
              styles.thread,
              { paddingTop: headerTop + Spacing.md, paddingBottom: composerSpace },
            ]}
            onLayout={(event) => {
              const { height } = event.nativeEvent.layout;
              metrics.current.viewport = height;
              setViewport(height);
            }}
            onScroll={onScroll}
            scrollEventThrottle={32}
            onContentSizeChange={onContentSizeChange}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            {items.slice(0, history).map(renderRow)}
            <Animated.View layout={Motion.layout}>
              <Greeting minHeight={greetingHeight} inset={headerTop} />
            </Animated.View>
            {items.slice(history).map(renderRow)}
            <Animated.View style={[styles.keyboardSpace, keyboardSpace]} />
          </ScrollView>
        </Animated.View>
        <WedHeader onMenu={openMenu} onClose={close} onHeight={setHeaderHeight} quiet={chipShown} />
        {chipShown && runningId && runningKey ? (
          <ProgressChip
            taskId={runningId}
            top={headerTop + Spacing.sm}
            onPress={() => scrollToKey(runningKey)}
          />
        ) : null}
        {/* The page behind the composer, fading out above it, so no
            half-cut line of the thread shows below it */}
        <Animated.View
          style={[
            styles.bottomEdge,
            { height: composerSpace },
            backgroundCss(Colors.canvasEdgeUp),
            keyboardLift,
          ]}
        />
        <WedComposer bottom={composerBottom} onHeight={setComposerHeight} />
        {/* "Saved to Jaago · See list" rises from behind the composer */}
        <SavedToastHost bottom={composerBottom + composerCover} />
      </Animated.View>
      <WedMenu open={menuOpen} onClose={closeMenu} />
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  screen: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  fill: {
    flex: 1,
  },
  thread: {
    gap: Spacing.lg,
    paddingHorizontal: Sizes.pageGutter,
  },
  // Cancels the gap before it, so it adds nothing until the keyboard opens
  keyboardSpace: {
    marginTop: -Spacing.lg,
  },
  bottomEdge: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
}));
