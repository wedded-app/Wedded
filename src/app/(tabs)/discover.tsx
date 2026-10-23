import { useFocusEffect, useRouter } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Glass } from '@/components/glass';
import { Icon } from '@/components/icon';
import { storyRingStyle } from '@/components/story-ring';
import { Radius, Spacing, useScheme } from '@/constants/theme';
import { useHomeEvents } from '@/data/reference';
import type { FeedMode } from '@/data/reels';
import { useSession } from '@/features/auth/session';
import { FeedSwitch } from '@/features/reels/feed-switch';
import { REEL_DIM, REEL_INK } from '@/features/reels/reel-item';
import { ReelsPager } from '@/features/reels/reels-pager';
import { StoryFace, useStoryTray } from '@/features/stories/stories-bar';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';

/**
 * Reels (the Discover tab; DECISIONS.md 2026-10-05): wedding clips from
 * families and vendors, one per screen, swipe up for the next. The top is
 * iOS's (the final look, 2026-10-23): story rings on the left, For you and
 * Following in a glass switch in the middle (For you shows everything,
 * Following the people and vendors you follow), and a plus to post on the
 * right. One chip under them ("All events") opens the family's main events
 * (Jaago, Mehndi…, from the database) to narrow either feed; it folds away
 * again once one is picked, so ten choices don't sit over every video
 * (Hick's law). Every reel is one tap from booking its vendor (the strip in
 * booking-strip.tsx). The rings play everyone's stories full screen, from
 * the first person with something new (DECISIONS.md 2026-10-16), so they
 * never cover the video.
 */
export default function ReelsScreen({ business = false }: { business?: boolean }) {
  const { t } = useLocale();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [height, setHeight] = useState(0);
  const { status, requireSignIn } = useSession();
  const [mode, setMode] = useState<FeedMode>('for_you');
  const [eventSlug, setEventSlug] = useState<string | null>(null);
  const [eventsOpen, setEventsOpen] = useState(false);
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
  // Two rings at most, others' first; just yours when nobody else has one
  const others = tray.groups.filter((group) => !group.isMine);
  const mine = tray.groups.find((group) => group.isMine);
  const faces = others.length > 0 ? others.slice(0, 2) : mine ? [mine] : [];

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
    setEventsOpen(false);
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
      {height > 0 &&
        // Following needs an account: signed out, it asks to sign in
        (mode === 'following' && status === 'signedOut' ? (
          <View style={[styles.center, { height }]}>{emptyFollowing}</View>
        ) : (
          <ReelsPager
            key={`${mode}:${eventSlug ?? ''}`}
            feed={{ mode, eventSlug }}
            height={height}
            swipeHint
            business={business}
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
        ))}

      <View style={[styles.top, { paddingTop: insets.top + Spacing.xs }]} pointerEvents="box-none">
        <View style={styles.bar} pointerEvents="box-none">
          {/* Stories: the rings of the first two with one today, new ones first */}
          <View style={styles.side} pointerEvents="box-none">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                tray.fresh > 0 ? t('stories.button', { count: tray.fresh }) : t('stories.title')
              }
              onPress={watchStories}
              hitSlop={4}
              style={({ pressed }) => [styles.rings, pressed && styles.pressed]}
            >
              {faces.length > 0 ? (
                faces.map((group, index) => (
                  <View
                    key={group.key}
                    style={[
                      styles.ring,
                      tray.seen(group) ? styles.ringSeen : storyRingStyle,
                      index > 0 && styles.ringBehind,
                    ]}
                  >
                    <View style={styles.face}>
                      <StoryFace group={group} size={FACE} photo />
                    </View>
                  </View>
                ))
              ) : (
                <Glass scheme="dark" style={styles.round}>
                  <Icon name="images-outline" size={22} color={REEL_INK} />
                </Glass>
              )}
            </Pressable>
          </View>
          <FeedSwitch
            options={[
              { value: 'for_you', label: t('reels.forYou') },
              { value: 'following', label: t('reels.following') },
            ]}
            value={mode}
            onChange={choose}
          />
          {/* Post a reel */}
          <View style={[styles.side, styles.sideEnd]} pointerEvents="box-none">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('reels.create')}
              onPress={() => requireSignIn(() => router.push('/post-reel'))}
              hitSlop={4}
              style={({ pressed }) => pressed && styles.pressedSmall}
            >
              <Glass scheme="dark" interactive style={styles.round}>
                <Icon name="add" size={24} color={REEL_INK} weight="semibold" />
              </Glass>
            </Pressable>
          </View>
        </View>
        {events.length > 0 && !eventsOpen && (
          <View style={styles.oneChip}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: false }}
              accessibilityHint={t('reels.chooseEvent')}
              onPress={() => {
                selectionHaptic();
                setEventsOpen(true);
              }}
              // Slim over the video; its touch area is 48 tall
              hitSlop={{ top: 6, bottom: 6 }}
              style={({ pressed }) => [
                styles.chip,
                styles.chipRow,
                eventSlug !== null && styles.chipOn,
                pressed && styles.pressed,
              ]}
            >
              <AppText
                variant="label"
                weight={eventSlug ? 700 : 600}
                numberOfLines={1}
                style={eventSlug ? styles.chipTextOn : styles.tabText}
              >
                {eventName ?? t('reels.everyEvent')}
              </AppText>
              <Icon name="chevron-down" size={14} color={eventSlug ? '#000000' : REEL_INK} />
            </Pressable>
          </View>
        )}
        {events.length > 0 && eventsOpen && (
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

// A story ring, the face inside it, and the round glass button, in points
const RING = 40;
const FACE = RING - 8;
const ROUND = 44;

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
  // Rings, the switch and the plus, the switch in the middle
  bar: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  side: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sideEnd: {
    justifyContent: 'flex-end',
  },
  rings: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ring: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    padding: 2,
  },
  ringSeen: {
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  // The second ring tucks under the first's edge
  ringBehind: {
    marginLeft: -12,
  },
  face: {
    flex: 1,
    borderRadius: RING / 2,
    borderWidth: 2,
    borderColor: '#000000',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(138,28,51,0.9)',
  },
  round: {
    width: ROUND,
    height: ROUND,
    borderRadius: ROUND / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    color: REEL_INK,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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
  oneChip: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 6,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 4,
    maxWidth: '100%',
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
  pressedSmall: {
    transform: [{ scale: 0.94 }],
  },
});
