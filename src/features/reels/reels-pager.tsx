import { useFocusEffect, usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Share,
  StyleSheet,
  View,
  type ViewToken,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { useBottomSpace } from '@/components/tab-bar';
import { Radius, Spacing } from '@/constants/theme';
import { useTraditions } from '@/data/reference';
import {
  type Reel,
  reelVendors,
  useDeleteReel,
  useReelsFeed,
  useToggleBlock,
  useToggleFollow,
  useToggleLike,
} from '@/data/reels';
import { useSession } from '@/features/auth/session';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { readSetting, StorageKeys, writeSetting } from '@/lib/storage';

import { REEL_INK, ReelItem } from './reel-item';

type Feed = Parameters<typeof useReelsFeed>[0];

// Sound plays from the start, as on TikTok and Instagram; the sound button
// turns it off for every reel. Browsers only autoplay muted video.
let soundOn = Platform.OS !== 'web';

// The pager that opened the comments sheet keeps playing above it.
let commentsOwner: string | null = null;

/**
 * A full-screen, swipe-up feed of reels: one reel per screen, only the one
 * on screen plays, everything pauses when you leave the tab, and the next
 * page loads before you reach the end. Liking, following and commenting ask
 * you to sign in first; watching never does.
 */
export function ReelsPager({
  feed,
  height,
  empty,
  initialIndex = 0,
  swipeHint = false,
}: {
  feed: Feed;
  /** Show "Swipe up for more" the first time (the Reels tab). */
  swipeHint?: boolean;
  /** Start on this reel (a person's grid opening one of theirs). */
  initialIndex?: number;
  /** The height of one reel: the screen the pager fills. */
  height: number;
  /** Shown when the feed has nothing (yet). */
  empty: ReactNode;
}) {
  const router = useRouter();
  const { t, locale } = useLocale();
  const { requireSignIn, session } = useSession();
  const bottomSpace = useBottomSpace();
  const reels = useReelsFeed(feed);
  const traditions = useTraditions();
  const like = useToggleLike();
  const follow = useToggleFollow();
  const block = useToggleBlock();
  const remove = useDeleteReel();
  const [active, setActive] = useState(initialIndex);
  const [focused, setFocused] = useState(true);
  const [muted, setMuted] = useState(!soundOn);
  const [hint, setHint] = useState(
    () => swipeHint && readSetting(StorageKeys.reelsSwipeHint) !== 'done',
  );
  const id = useId();
  const pathname = usePathname();
  const commentsOpen = pathname === '/reel-comments' && commentsOwner === id;
  const playing = focused || commentsOpen;

  const hintDone = () => {
    if (!hint) return;
    setHint(false);
    void writeSetting(StorageKeys.reelsSwipeHint, 'done');
  };

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const list = useMemo(() => reels.data?.pages.flat() ?? [], [reels.data]);

  // Each event's name in the family's tradition and language
  const eventNames = useMemo(() => {
    const names: Record<string, string> = {};
    for (const tradition of traditions.data ?? []) {
      for (const event of tradition.events) {
        names[event.slug] ??= localized(event.name, locale);
      }
    }
    return names;
  }, [traditions.data, locale]);

  // Stable, as FlatList requires
  const onViewable = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems.find((v) => v.isViewable);
    if (first?.index != null) setActive(first.index);
  }, []);

  const share = async (reel: Reel) => {
    const who = reel.vendor?.name ?? reel.authorName ?? '';
    const message = t('reels.shareMessage', { name: who });
    try {
      await Share.share({ message });
    } catch {
      // Dismissed: nothing to do
    }
  };

  // One vendor: straight to Ask. Several: pick one first. Ask itself
  // handles signing in, so watching and choosing never need an account.
  const book = (reel: Reel) => {
    const vendors = reelVendors(reel);
    const event = reel.eventSlug ? { event: reel.eventSlug } : {};
    if (vendors.length === 1) {
      router.push({ pathname: '/ask', params: { vendorId: vendors[0].id, ...event } });
    } else if (vendors.length > 1) {
      router.push({
        pathname: '/reel-book',
        params: { vendors: vendors.map((v) => v.slug).join(','), ...event },
      });
    }
  };

  const more = (reel: Reel) => {
    const report = () => router.push({ pathname: '/reel-report', params: { reel: reel.id } });
    const choices: { text: string; style?: 'destructive' | 'cancel'; onPress?: () => void }[] =
      reel.isMine
        ? [
            {
              text: t('reels.delete'),
              style: 'destructive',
              onPress: () => remove.mutate(reel),
            },
          ]
        : [
            { text: t('reels.report'), onPress: () => requireSignIn(report) },
            ...(reel.vendor
              ? []
              : [
                  {
                    text: t('reels.block', { name: reel.authorName ?? t('reels.someone') }),
                    style: 'destructive' as const,
                    onPress: () =>
                      requireSignIn(() => block.mutate({ userId: reel.authorId, block: true })),
                  },
                ]),
          ];
    if (Platform.OS === 'web') {
      // Alert does nothing in a browser: the first choice is the useful one
      if (globalThis.confirm(choices[0].text)) choices[0].onPress?.();
      return;
    }
    Alert.alert(t('reels.more'), undefined, [
      ...choices,
      { text: t('reels.cancel'), style: 'cancel' },
    ]);
  };

  if (reels.isPending) {
    return (
      <View style={[styles.center, { height }]}>
        <ActivityIndicator color={REEL_INK} />
      </View>
    );
  }
  if (list.length === 0) {
    return <View style={[styles.center, { height }]}>{empty}</View>;
  }

  return (
    <View style={styles.fill}>
      <FlatList
        data={list}
        keyExtractor={(reel) => reel.id}
        renderItem={({ item, index }) => (
          <ReelItem
            reel={item}
            height={height}
            active={playing && index === active}
            muted={muted}
            eventName={item.eventSlug ? (eventNames[item.eventSlug] ?? null) : null}
            bottomSpace={bottomSpace}
            onToggleMute={() => {
              soundOn = muted;
              setMuted(!muted);
            }}
            onLike={(reel, liked) =>
              requireSignIn(() => like.mutate({ reelId: reel.id, like: liked }))
            }
            onFollow={(reel) =>
              requireSignIn(() =>
                follow.mutate({
                  target: reel.vendor ? { vendorId: reel.vendor.id } : { userId: reel.authorId },
                  follow: true,
                }),
              )
            }
            onComments={(reel) => {
              commentsOwner = id;
              router.push({
                pathname: '/reel-comments',
                params: reel.isMine ? { reel: reel.id, mine: '1' } : { reel: reel.id },
              });
            }}
            onShare={(reel) => void share(reel)}
            onMore={more}
            onBook={book}
          />
        )}
        pagingEnabled
        // One reel per swipe, however hard the flick
        disableIntervalMomentum
        onScrollBeginDrag={hintDone}
        snapToInterval={height}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        onEndReachedThreshold={2}
        onEndReached={() => {
          if (reels.hasNextPage && !reels.isFetchingNextPage) void reels.fetchNextPage();
        }}
        refreshing={reels.isRefetching && !reels.isFetchingNextPage}
        onRefresh={() => void reels.refetch()}
        windowSize={3}
        initialScrollIndex={initialIndex < list.length ? initialIndex : 0}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        removeClippedSubviews
        // A key per account, so signing in or out starts the list fresh
        extraData={session?.user.id}
      />
      {hint && active === 0 && list.length > 1 && (
        <SwipeHint label={t('reels.swipeHint')} bottom={bottomSpace + 200} />
      )}
    </View>
  );
}

/** A bouncing "Swipe up for more" the first time someone opens Reels. */
function SwipeHint({ label, bottom }: { label: string; bottom: number }) {
  const reduceMotion = useReducedMotion();
  const lift = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    lift.set(
      withRepeat(
        withSequence(withTiming(-14, { duration: 520 }), withTiming(0, { duration: 520 })),
        -1,
      ),
    );
  }, [lift, reduceMotion]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }] }));
  return (
    <View pointerEvents="none" style={[styles.hint, { bottom }]}>
      <Animated.View style={style}>
        <Icon name="chevron-up" size={36} color={REEL_INK} />
      </Animated.View>
      <View style={styles.hintPill}>
        <AppText weight={700} style={styles.hintText}>
          {label}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  hint: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  hintPill: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.chip,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  hintText: {
    color: REEL_INK,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
});
