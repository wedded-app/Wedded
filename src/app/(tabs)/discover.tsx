import { useFocusEffect, useRouter } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { Radius, Spacing, useScheme } from '@/constants/theme';
import { useHomeEvents } from '@/data/reference';
import type { FeedMode } from '@/data/reels';
import { useSession } from '@/features/auth/session';
import { REEL_DIM, REEL_INK } from '@/features/reels/reel-item';
import { ReelsPager } from '@/features/reels/reels-pager';
import { useStoryTray } from '@/features/stories/stories-bar';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';

/**
 * Reels (the Discover tab; DECISIONS.md 2026-10-05): wedding clips from
 * families and vendors, one per screen, swipe up for the next. Following
 * shows the people and vendors you follow; For you shows everything. Chips
 * under them narrow either feed to one of the family's main events (Jaago,
 * Mehndi…), from the database. The vendors in each clip are one tap away.
 * Stories sit beside them in the top bar: one tap plays everyone's stories
 * full screen, from the first person with something new (DECISIONS.md
 * 2026-10-16), so they never cover the video.
 */
export default function ReelsScreen() {
  const { t } = useLocale();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [height, setHeight] = useState(0);
  const { status, requireSignIn } = useSession();
  const [mode, setMode] = useState<FeedMode>('for_you');
  const [eventSlug, setEventSlug] = useState<string | null>(null);
  const scheme = useScheme();
  const homeEvents = useHomeEvents();
  const tray = useStoryTray();

  // The family's main events in ceremony order, as on Home
  const events = useMemo(
    () =>
      (homeEvents.data ?? [])
        .flatMap((section) => section.events)
        .filter((event) => event.isCore)
        .map((event) => ({ slug: event.slug, name: localized(event.name) })),
    [homeEvents.data],
  );
  const eventName = events.find((event) => event.slug === eventSlug)?.name;

  // White clock and battery over the videos; back to the app's on the way out
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle(scheme === 'dark' ? 'light' : 'dark');
    }, [scheme]),
  );

  const choose = (next: FeedMode) => {
    if (next === mode) return;
    selectionHaptic();
    setMode(next);
  };

  // Everyone's stories in a row, from the first person with something new;
  // with none from anyone else, the Stories page (add yours, or see it's empty)
  const watchStories = () => {
    selectionHaptic();
    const others = tray.groups.filter((g) => !g.isMine);
    const first = others.find((g) => !tray.seen(g)) ?? others[0];
    if (first) router.push({ pathname: '/story', params: { group: first.key } });
    else router.push('/stories');
  };

  const filter = (next: string | null) => {
    if (next === eventSlug) return;
    selectionHaptic();
    setEventSlug(next);
  };

  const emptyFollowing =
    status === 'signedIn' ? (
      <Empty
        icon="people-outline"
        title={t('reels.followingEmptyTitle')}
        body={t('reels.followingEmptyBody')}
        action={t('reels.goForYou')}
        onAction={() => setMode('for_you')}
      />
    ) : (
      <Empty
        icon="people-outline"
        title={t('reels.followingSignInTitle')}
        body={t('reels.followingSignInBody')}
        action={t('reels.signIn')}
        onAction={() => requireSignIn()}
      />
    );
  const emptyEvent = (
    <Empty
      icon="film-outline"
      title={t('reels.eventEmptyTitle', { event: eventName ?? '' })}
      body={t('reels.eventEmptyBody')}
      action={t('reels.showAll')}
      onAction={() => setEventSlug(null)}
    />
  );
  const emptyForYou = (
    <Empty
      icon="film-outline"
      title={t('reels.emptyTitle')}
      body={t('reels.emptyBody')}
      action={t('reels.browseVendors')}
      onAction={() => router.push('/search')}
    />
  );

  return (
    <View
      style={styles.screen}
      onLayout={({ nativeEvent }) => setHeight(nativeEvent.layout.height)}
    >
      {height > 0 && (
        <ReelsPager
          key={`${mode}:${eventSlug ?? ''}`}
          feed={{ mode, eventSlug }}
          height={height}
          swipeHint
          empty={
            mode === 'following' && status !== 'signedIn'
              ? emptyFollowing
              : eventSlug
                ? emptyEvent
                : mode === 'following'
                  ? emptyFollowing
                  : emptyForYou
          }
        />
      )}

      <View style={[styles.top, { paddingTop: insets.top + Spacing.xs }]} pointerEvents="box-none">
        {/* Post a reel: top right, where Instagram's Reels camera sits */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('reels.create')}
          onPress={() => requireSignIn(() => router.push('/post-reel'))}
          hitSlop={8}
          style={({ pressed }) => [
            styles.create,
            { top: insets.top + Spacing.xs },
            pressed && styles.pressed,
          ]}
        >
          <Icon name="camera-outline" size={28} color={REEL_INK} style={styles.iconShadow} />
        </Pressable>
        <View style={styles.tabs} accessibilityRole="tablist">
          {(['following', 'for_you'] as const).map((m) => (
            <Pressable
              key={m}
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === m }}
              onPress={() => choose(m)}
              hitSlop={8}
              style={styles.tab}
            >
              <AppText
                variant="bodyLg"
                weight={mode === m ? 700 : 600}
                style={[styles.tabText, mode !== m && styles.tabDim]}
              >
                {m === 'following' ? t('reels.following') : t('reels.forYou')}
              </AppText>
              <View style={[styles.underline, mode !== m && styles.hidden]} />
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              tray.fresh > 0 ? t('stories.button', { count: tray.fresh }) : t('stories.title')
            }
            onPress={watchStories}
            hitSlop={8}
            style={styles.tab}
          >
            <View style={styles.storiesLabel}>
              <AppText variant="bodyLg" weight={600} style={[styles.tabText, styles.tabDim]}>
                {t('stories.title')}
              </AppText>
              {tray.fresh > 0 && <View style={styles.newDot} />}
            </View>
            <View style={[styles.underline, styles.hidden]} />
          </Pressable>
        </View>
        {events.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsRow}
            contentContainerStyle={styles.chips}
          >
            {[{ slug: null, name: t('reels.allEvents') }, ...events].map((event) => {
              const selected = event.slug === eventSlug;
              return (
                <Pressable
                  key={event.slug ?? 'all'}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => filter(event.slug)}
                  // Slim over the video; its touch area is 48 tall
                  hitSlop={{ top: 6, bottom: 6 }}
                  style={({ pressed }) => [
                    styles.chip,
                    selected && styles.chipOn,
                    pressed && styles.pressed,
                  ]}
                >
                  <AppText
                    variant="label"
                    weight={selected ? 700 : 600}
                    numberOfLines={1}
                    style={selected ? styles.chipTextOn : styles.tabText}
                  >
                    {event.name}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

function Empty({
  icon,
  title,
  body,
  action,
  onAction,
}: {
  icon: Parameters<typeof Icon>[0]['name'];
  title: string;
  body: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <View style={styles.empty}>
      <Icon name={icon} size={48} color={REEL_INK} />
      <AppText variant="heading" weight={700} style={[styles.tabText, styles.centerText]}>
        {title}
      </AppText>
      <AppText style={[styles.dimText, styles.centerText]}>{body}</AppText>
      <Pressable
        accessibilityRole="button"
        onPress={onAction}
        style={({ pressed }) => [styles.emptyButton, pressed && styles.pressed]}
      >
        <AppText weight={700} style={styles.emptyButtonText}>
          {action}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  // From the left, like Instagram's Reels, so three fit beside the camera on any phone
  tabs: {
    flexDirection: 'row',
    gap: Spacing.lg,
    alignSelf: 'flex-start',
    marginLeft: Spacing.lg,
  },
  storiesLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  // Someone has a story you haven't watched
  newDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B5C',
  },
  create: {
    position: 'absolute',
    right: Spacing.md,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconShadow: {
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  tab: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabText: {
    color: REEL_INK,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  tabDim: {
    color: REEL_DIM,
  },
  underline: {
    width: 24,
    height: 3,
    borderRadius: 2,
    backgroundColor: REEL_INK,
  },
  hidden: {
    opacity: 0,
  },
  chipsRow: {
    alignSelf: 'stretch',
    flexGrow: 0,
    marginTop: Spacing.sm,
  },
  chips: {
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 6,
  },
  chip: {
    minHeight: 36,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.chip,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  chipOn: {
    backgroundColor: REEL_INK,
    borderColor: REEL_INK,
  },
  chipTextOn: {
    color: '#000000',
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xxl,
  },
  centerText: {
    textAlign: 'center',
  },
  dimText: {
    color: REEL_DIM,
  },
  emptyButton: {
    minHeight: 48,
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.sm,
    borderRadius: Radius.chip,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: REEL_INK,
  },
  emptyButtonText: {
    color: '#000000',
  },
  pressed: {
    opacity: 0.6,
  },
});
