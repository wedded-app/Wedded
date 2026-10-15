import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { BackHandler, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText, useFontScale } from '@/components/app-text';
import { Icon, type IconName } from '@/components/icon';
import { useHideTabBar } from '@/components/tab-bar';
import { makeStyles, Radius, Sizes, Spacing, Springs, useColors } from '@/constants/theme';

import { useWed, waitingCount } from './wed-store';
import { WedMark } from './wed-mark';

const MAX_WIDTH = 360;
// How far the thread behind the menu shifts while it's open
const SHIFT = 12;
const FADE_MS = 200;

type Row = { icon: IconName; title: string; subtitle?: string; href: Href; count?: number };

/**
 * Wed's side menu, opened by the menu button at the top left of the chat
 * (a tap only; no edge swipe): Wed's pages in two groups, Updates (with how
 * many cards wait), Goals, Ideas, Lists and photos, then Apps Wed can use,
 * How much Wed does and What Wed knows. A white panel slides in from the
 * left over a dimmed thread, and the tab bar slides away while it's open.
 * Closes on the dimmed side, Android's back button or Escape on the web; a
 * plain crossfade with Reduce Motion. Render it last in the chat screen's
 * root view, and shift the thread with useWedMenuShift(open).
 */
export function WedMenu({ open, onClose }: { open: boolean; onClose(): void }) {
  const Colors = useColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const waiting = useWed(waitingCount);
  const mode = useWed((s) => s.mode);
  const [mounted, setMounted] = useState(open);
  const [width, setWidth] = useState(0);
  const progress = useSharedValue(0);
  const panelWidth = Math.min(MAX_WIDTH, Math.round((width || MAX_WIDTH / 0.84) * 0.84));

  useHideTabBar(open);

  // Mounted as soon as it opens; unmounted once it has slid out
  if (open && !mounted) setMounted(true);

  useEffect(() => {
    if (open) {
      progress.value = reduceMotion
        ? withTiming(1, { duration: FADE_MS })
        : withSpring(1, Springs.smooth);
      return;
    }
    const finish = (done?: boolean) => {
      'worklet';
      if (done) scheduleOnRN(setMounted, false);
    };
    progress.value = reduceMotion
      ? withTiming(0, { duration: FADE_MS }, finish)
      : withSpring(0, Springs.smooth, finish);
  }, [open, reduceMotion, progress]);

  // Android's back button and Escape on the web close it
  useEffect(() => {
    if (!open) return;
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    if (Platform.OS === 'web') window.addEventListener('keydown', onKey);
    return () => {
      back.remove();
      if (Platform.OS === 'web') window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const scrim = useAnimatedStyle(() => ({ opacity: progress.value }));
  const panel = useAnimatedStyle(() =>
    reduceMotion
      ? { opacity: progress.value }
      : { transform: [{ translateX: -panelWidth * (1 - progress.value) }] },
  );

  if (!mounted && !open) return null;

  const go = (href: Href) => {
    onClose();
    router.push(href);
  };

  const first: Row[] = [
    {
      icon: 'notifications-outline',
      title: 'Updates',
      subtitle: 'Needs your OK, working on, done',
      href: '/wed/updates',
      count: waiting,
    },
    { icon: 'flag-outline', title: 'Goals', subtitle: 'One for each event', href: '/wed/goals' },
    {
      icon: 'bulb-outline',
      title: 'Ideas',
      subtitle: 'Things Wed can do next',
      href: '/wed/ideas',
    },
    { icon: 'images-outline', title: 'Lists and photos', href: '/wed/library' },
  ];
  const second: Row[] = [
    { icon: 'apps-outline', title: 'Apps Wed can use', href: '/wed/apps' },
    {
      icon: 'options-outline',
      title: 'How much Wed does',
      subtitle: mode === 'ask' ? 'Ask me first' : 'Do the small things',
      href: '/wed/settings',
    },
    { icon: 'book-outline', title: 'What Wed knows', href: '/wed/memory' },
  ];

  return (
    <View
      style={[StyleSheet.absoluteFill, !open && styles.inert]}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.scrim }, scrim]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close the menu"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View accessibilityViewIsModal style={[styles.panel, { width: panelWidth }, panel]}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: Math.max(insets.top, Spacing.sm),
              paddingBottom: Math.max(insets.bottom, Spacing.lg),
            },
          ]}
        >
          <View style={styles.header}>
            <WedMark size={28} />
            <AppText variant="section" accessibilityRole="header" style={styles.grow}>
              Wed
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close the menu"
              onPress={onClose}
              style={({ pressed }) => [styles.close, pressed && styles.pressed]}
            >
              <Icon name="close" size={24} color={Colors.text} weight="semibold" />
            </Pressable>
          </View>
          {first.map((row) => (
            <MenuRow key={row.title} row={row} onPress={() => go(row.href)} />
          ))}
          <View style={styles.hairline} />
          {second.map((row) => (
            <MenuRow key={row.title} row={row} onPress={() => go(row.href)} />
          ))}
          <AppText variant="label" weight={400} color="text2" style={styles.footer}>
            Wed never messages, books or pays without your tap.
          </AppText>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

/**
 * The thread's shift behind the menu: 12 points to the right while it's open,
 * on the same spring (none with Reduce Motion). Put it on the view that holds
 * the thread and header.
 */
export function useWedMenuShift(open: boolean) {
  const reduceMotion = useReducedMotion();
  const shift = useSharedValue(0);
  useEffect(() => {
    const target = open ? SHIFT : 0;
    shift.value = reduceMotion ? 0 : withSpring(target, Springs.smooth);
  }, [open, reduceMotion, shift]);
  return useAnimatedStyle(() => ({ transform: [{ translateX: shift.value }] }));
}

function MenuRow({ row, onPress }: { row: Row; onPress: () => void }) {
  const Colors = useColors();
  const styles = useStyles();
  const scale = Math.min(useFontScale('body'), 1.4);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={row.count ? `${row.title}, ${row.count} need your OK` : row.title}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={[styles.icon, { width: Sizes.rowIcon * scale }]}>
        <Icon name={row.icon} size={Sizes.icon * scale} color={Colors.text} />
      </View>
      <View style={styles.grow}>
        <AppText weight={500}>{row.title}</AppText>
        {row.subtitle ? (
          <AppText variant="label" weight={400} color="text2">
            {row.subtitle}
          </AppText>
        ) : null}
      </View>
      {row.count ? (
        <View style={styles.count}>
          <AppText variant="label" weight={600} color="onPrimary">
            {String(row.count)}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

const useStyles = makeStyles((Colors) => ({
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: Colors.surface,
    borderTopRightRadius: Radius.card,
    borderBottomRightRadius: Radius.card,
    boxShadow: '0 0 40px rgba(0, 0, 0, 0.18)',
  },
  content: {
    paddingHorizontal: Spacing.sm,
  },
  header: {
    minHeight: Sizes.navBar,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingLeft: Spacing.md,
    marginBottom: Spacing.sm,
  },
  close: {
    width: Sizes.tapTarget,
    height: Sizes.tapTarget,
    borderRadius: Sizes.tapTarget / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    minHeight: Sizes.row,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.field,
  },
  rowPressed: {
    backgroundColor: Colors.rowPressed,
  },
  icon: {
    alignItems: 'center',
  },
  count: {
    minWidth: 28,
    height: 28,
    paddingHorizontal: Spacing.sm,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryFill,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.sm,
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.separator,
  },
  footer: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
  },
  inert: {
    pointerEvents: 'none',
  },
  grow: {
    flex: 1,
  },
  pressed: {
    opacity: 0.55,
  },
}));
