import { useEventListener } from 'expo';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { StateView } from '@/components/state-view';
import { makeStyles, Radius, Sizes, Spacing, Springs } from '@/constants/theme';
import { useFeed } from '@/data/feed';
import { useToggleBlock } from '@/data/reels';
import { useSavedVendors, useSaveVendor } from '@/data/saved';
import { type Story, type StoryGroup, useDeleteStory, useStories } from '@/data/stories';
import { useSession } from '@/features/auth/session';
import { initials } from '@/features/planner/plan-together';
import { timeAgo } from '@/features/requests/requests-format';
import { markStorySeen, trayOrder, useStorySeen } from '@/features/stories/seen-stories';
import { shareVendor } from '@/features/vendors/share';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { saveHaptic } from '@/lib/haptics';

const PHOTO_MS = 5000;
const CLOSE_DRAG = 120;
// How far a sideways swipe goes before it changes person
const SKIP_DRAG = 60;
// Browsers only autoplay muted video
const MUTED = Platform.OS === 'web';

const topShade = (
  Platform.OS === 'web'
    ? { backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0.7), rgba(0,0,0,0))' }
    : { experimental_backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0.7), rgba(0,0,0,0))' }
) as ViewStyle;
const bottomShade = (
  Platform.OS === 'web'
    ? { backgroundImage: 'linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0))' }
    : { experimental_backgroundImage: 'linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0))' }
) as ViewStyle;

type Slide = {
  id: string;
  kind: 'photo' | 'video';
  url: string;
  blurhash: string | null;
  caption: string | null;
  /** When a posted story went up, for "3 hours ago". */
  postedAt: string | null;
  /** The posted story itself, to delete it. */
  story: Story | null;
};

/** Whoever's slides are playing: a poster's stories, or a vendor's photos. */
type Teller = {
  key: string;
  name: string;
  /** "Photographer · Fremont" for a vendor's photos. */
  place: string | null;
  avatarUrl: string | null;
  vendor: { id: string; slug: string; category: string | null; city: string } | null;
  personId: string | null;
  isMine: boolean;
  isSample: boolean;
  /** Posted stories: marked watched as they play, and can be reported. */
  live: boolean;
  slides: Slide[];
};

function fromGroup(group: StoryGroup, someone: string): Teller {
  return {
    key: group.key,
    name: group.name ?? someone,
    place: null,
    avatarUrl: null,
    vendor: group.vendor
      ? { id: group.vendor.id, slug: group.vendor.slug, category: null, city: '' }
      : null,
    personId: group.vendor ? null : group.authorId,
    isMine: group.isMine,
    isSample: group.isSample,
    live: true,
    slides: group.stories.map((story) => ({
      id: story.id,
      kind: story.kind,
      url: story.url,
      blurhash: null,
      caption: story.caption,
      postedAt: story.createdAt,
      story,
    })),
  };
}

/**
 * The full-screen story viewer, like Instagram's and TikTok's: one photo or
 * clip after another with progress bars along the top. Tap the right side
 * for the next, the left for the one before; hold to pause; swipe down or
 * tap Close to leave; swipe sideways for the next or previous person. After
 * the last it moves on to the next person.
 *
 * /story?group={key}: posted stories (the Reels tab's rings), starting at
 * the first one not yet watched. /story?vendor={slug}&photo={id}: a vendor's
 * photos (their page's highlights), then the next vendor's.
 */
export default function StoryScreen() {
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLocale();
  const reduceMotion = useReducedMotion();
  const { requireSignIn } = useSession();
  const params = useLocalSearchParams<{ group?: string; vendor?: string; photo?: string }>();
  const live = params.group !== undefined;
  const feed = useFeed({ enabled: !live });
  const stories = useStories();
  const isSeen = useStorySeen();
  const saves = useSavedVendors();
  const { toggleSave } = useSaveVendor();
  const remove = useDeleteStory();
  const block = useToggleBlock();
  const source = live ? stories : feed;

  // Who plays in which order, fixed when the viewer opens so rings turning
  // grey don't reshuffle it
  const [order, setOrder] = useState<string[] | null>(null);
  if (live && order === null && stories.data) {
    setOrder(trayOrder(stories.data, isSeen).map((group) => group.key));
  }

  const someone = t('reels.someone');
  const tellers = useMemo((): Teller[] => {
    if (!live) {
      return (feed.data ?? []).map((post) => {
        const category = post.category ? localized(post.category.name) : null;
        const caption = post.caption?.trim() || null;
        return {
          key: post.slug,
          name: localized(post.name),
          place: [category, post.city].filter(Boolean).join(' · '),
          avatarUrl: post.photos[0]?.url.small ?? null,
          vendor: { id: post.vendorId, slug: post.slug, category, city: post.city },
          personId: null,
          isMine: false,
          isSample: post.isSample,
          live: false,
          slides: post.photos.map((photo) => ({
            id: photo.id,
            kind: 'photo',
            url: photo.url.large,
            blurhash: photo.blurhash,
            caption,
            postedAt: null,
            story: null,
          })),
        };
      });
    }
    const byKey = new Map((stories.data ?? []).map((group) => [group.key, group]));
    return (order ?? []).flatMap((key) => {
      const group = byKey.get(key);
      return group ? [fromGroup(group, someone)] : [];
    });
  }, [live, feed.data, stories.data, order, someone]);

  // A poster's stories start at the first one not yet watched
  const firstUnseen = (teller: Teller) =>
    teller.live
      ? Math.max(
          0,
          teller.slides.findIndex((slide) => !isSeen(slide.id)),
        )
      : 0;

  const [position, setPosition] = useState<{ teller: number; slide: number } | null>(null);
  if (position === null && tellers.length > 0) {
    const start = Math.max(
      0,
      tellers.findIndex((teller) => teller.key === (live ? params.group : params.vendor)),
    );
    const slide = live
      ? firstUnseen(tellers[start])
      : Math.max(
          0,
          tellers[start].slides.findIndex((s) => s.id === params.photo),
        );
    setPosition({ teller: start, slide });
  }

  const [paused, setPaused] = useState(false);
  const [focused, setFocused] = useState(true);
  const stopped = paused || !focused;
  const progress = useSharedValue(0);
  const zoom = useSharedValue(1);
  const dragY = useSharedValue(0);
  const elapsed = useRef(0);
  const startedAt = useRef(0);

  const teller = position ? tellers[position.teller] : undefined;
  // A story that ran out while watching drops off the end
  const slide = teller?.slides[Math.min(position?.slide ?? 0, teller.slides.length - 1)];
  const slideIndex = teller && slide ? teller.slides.indexOf(slide) : 0;

  // The report sheet opens over the viewer: wait while it's up
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const close = () => (router.canGoBack() ? router.back() : router.navigate('/discover'));

  // 1 next, -1 back, 0 close.
  const go = (step: 1 | -1 | 0) => {
    elapsed.current = 0;
    startedAt.current = 0;
    cancelAnimation(progress);
    progress.set(0);
    if (step === 0 || !teller || !position) {
      close();
      return;
    }
    const next = slideIndex + step;
    if (next >= 0 && next < teller.slides.length) {
      setPosition({ teller: position.teller, slide: next });
    } else if (step === 1 && position.teller + 1 < tellers.length) {
      setPosition({
        teller: position.teller + 1,
        slide: firstUnseen(tellers[position.teller + 1]),
      });
    } else if (step === -1 && position.teller > 0) {
      setPosition({ teller: position.teller - 1, slide: 0 });
    } else if (step === 1) {
      close();
    }
  };
  // Swipe left or right: the next person's stories or the last one's, like Instagram
  const skip = (step: 1 | -1) => {
    if (!position) return;
    const next = position.teller + step;
    if (next < 0) return;
    if (next >= tellers.length) {
      close();
      return;
    }
    elapsed.current = 0;
    startedAt.current = 0;
    cancelAnimation(progress);
    progress.set(0);
    setPosition({ teller: next, slide: step === 1 ? firstUnseen(tellers[next]) : 0 });
  };

  // The timer, the clip's end, the key handlers and the swipe call the latest `go` and `skip`
  const goRef = useRef(go);
  const skipRef = useRef(skip);
  useEffect(() => {
    goRef.current = go;
    skipRef.current = skip;
  });

  const slideId = slide?.id;
  const slideKind = slide?.kind;
  const slideLive = teller?.live ?? false;
  useEffect(() => {
    if (slideId && slideLive) markStorySeen(slideId);
  }, [slideId, slideLive]);

  // A photo's timer and its progress bar (a clip runs its own); pausing
  // keeps the time already watched.
  useEffect(() => {
    if (!slideId || slideKind !== 'photo') return;
    if (stopped) {
      if (startedAt.current > 0) elapsed.current += Date.now() - startedAt.current;
      startedAt.current = 0;
      cancelAnimation(progress);
      cancelAnimation(zoom);
      return;
    }
    const remaining = Math.max(0, PHOTO_MS - elapsed.current);
    startedAt.current = Date.now();
    progress.set(elapsed.current / PHOTO_MS);
    progress.set(withTiming(1, { duration: remaining, easing: Easing.linear }));
    if (!reduceMotion) {
      if (elapsed.current === 0) zoom.set(1);
      zoom.set(withTiming(1.08, { duration: remaining, easing: Easing.linear }));
    }
    const timer = setTimeout(() => goRef.current(1), remaining);
    return () => clearTimeout(timer);
  }, [slideId, slideKind, stopped, progress, zoom, reduceMotion]);

  // Arrow keys and Escape in a browser.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') goRef.current(1);
      else if (event.key === 'ArrowLeft') goRef.current(-1);
      else if (event.key === 'Escape') goRef.current(0);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // A sideways swipe asks for the next or previous person; `n` makes each one new
  const [swipe, setSwipe] = useState<{ step: 1 | -1; n: number } | null>(null);
  useEffect(() => {
    if (swipe) skipRef.current(swipe.step);
  }, [swipe]);

  // Swipe down to close, the way stories and photo viewers dismiss; sideways
  // for the next or previous person.
  const [pan] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        (g.dy > 12 && Math.abs(g.dy) > Math.abs(g.dx)) ||
        (Math.abs(g.dx) > 16 && Math.abs(g.dx) > Math.abs(g.dy)),
      onPanResponderMove: (_, g) => {
        if (Math.abs(g.dy) > Math.abs(g.dx)) dragY.set(Math.max(0, g.dy));
      },
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) > Math.abs(g.dy)) {
          if (Math.abs(g.dx) > SKIP_DRAG) {
            const step = g.dx < 0 ? 1 : -1;
            setSwipe((last) => ({ step, n: (last?.n ?? 0) + 1 }));
          }
        } else if (g.dy > CLOSE_DRAG) {
          close();
        } else {
          dragY.set(withSpring(0, Springs.snappy));
        }
      },
    }),
  );

  const barStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  const zoomStyle = useAnimatedStyle(() => ({ transform: [{ scale: zoom.value }] }));
  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.value }, { scale: 1 - Math.min(dragY.value, 300) / 2000 }],
    borderRadius: Math.min(dragY.value / 3, Radius.sheet),
  }));

  if (!teller || !slide) {
    return (
      <View style={styles.screen}>
        <StatusBar style="light" />
        {source.isPending ? (
          <StateView state="loading" />
        ) : source.isError ? (
          <StateView state="error" onRetry={() => void source.refetch()} />
        ) : (
          <StateView
            state="empty"
            icon="time-outline"
            message={t('stories.gone')}
            action={{ label: t('story.close'), onPress: close }}
          />
        )}
      </View>
    );
  }

  const { name, vendor } = teller;
  const saved = vendor ? (saves.data ?? []).some((save) => save.vendorId === vendor.id) : false;
  const subtitle = slide.postedAt ? timeAgo(slide.postedAt, t) : teller.place;
  const spoken = t(slide.kind === 'video' ? 'stories.clipOf' : 'discover.photoOf', {
    number: slideIndex + 1,
    total: teller.slides.length,
    name,
  });

  const leaveFor = (then: () => void) => {
    router.back();
    then();
  };
  const openProfile = () =>
    leaveFor(() => {
      if (vendor) router.push({ pathname: '/v/[slug]', params: { slug: vendor.slug } });
      else if (teller.personId)
        router.push({ pathname: '/u/[id]', params: { id: teller.personId } });
    });

  // A choice sheet; a browser gets its first (useful) choice as a confirm
  const ask = (
    title: string,
    choices: { text: string; style?: 'destructive'; onPress: () => void }[],
  ) => {
    if (Platform.OS === 'web') {
      if (globalThis.confirm(choices[0].text)) choices[0].onPress();
      return;
    }
    setPaused(true);
    Alert.alert(title, undefined, [
      ...choices.map((choice) => ({
        ...choice,
        onPress: () => {
          setPaused(false);
          choice.onPress();
        },
      })),
      { text: t('reels.cancel'), style: 'cancel', onPress: () => setPaused(false) },
    ]);
  };

  const personId = teller.personId;
  const more = () =>
    ask(t('reels.more'), [
      {
        text: t('reels.report'),
        onPress: () =>
          requireSignIn(() =>
            router.push({ pathname: '/reel-report', params: { story: slide.id } }),
          ),
      },
      ...(personId
        ? [
            {
              text: t('reels.block', { name }),
              style: 'destructive' as const,
              onPress: () =>
                requireSignIn(() => {
                  block.mutate({ userId: personId, block: true });
                  close();
                }),
            },
          ]
        : []),
    ]);

  const story = slide.story;
  const deleteStory = () =>
    ask(t('stories.deleteTitle'), [
      {
        text: t('stories.delete'),
        style: 'destructive',
        onPress: () => {
          if (story) remove.mutate(story, { onSuccess: close });
        },
      },
    ]);

  return (
    <View style={styles.screen} {...pan.panHandlers}>
      <StatusBar style="light" />
      <Animated.View style={[styles.stage, dragStyle]}>
        {slide.kind === 'video' ? (
          <StoryVideo
            key={slide.id}
            url={slide.url}
            paused={stopped}
            progress={progress}
            onEnd={() => goRef.current(1)}
            label={spoken}
          />
        ) : (
          <Animated.View style={[styles.fill, zoomStyle]}>
            <Image
              source={{ uri: slide.url }}
              placeholder={slide.blurhash ? { blurhash: slide.blurhash } : undefined}
              contentFit="cover"
              transition={180}
              accessible
              accessibilityLabel={spoken}
              style={styles.fill}
            />
          </Animated.View>
        )}

        {/* Tap zones: the left third goes back, the rest forward; hold to pause. */}
        <View style={styles.zones}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('story.previous')}
            onPress={() => go(-1)}
            onLongPress={() => setPaused(true)}
            onPressOut={() => setPaused(false)}
            delayLongPress={200}
            style={styles.zonePrev}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('story.next')}
            onPress={() => go(1)}
            onLongPress={() => setPaused(true)}
            onPressOut={() => setPaused(false)}
            delayLongPress={200}
            style={styles.zoneNext}
          />
        </View>

        <View style={[styles.top, topShade, { paddingTop: Math.max(insets.top, Spacing.md) }]}>
          <View style={styles.bars}>
            {teller.slides.map((item, i) => (
              <View key={item.id} style={styles.track}>
                {i < slideIndex && <View style={[styles.bar, styles.barFull]} />}
                {i === slideIndex && <Animated.View style={[styles.bar, barStyle]} />}
              </View>
            ))}
          </View>
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('story.viewProfile', { name })}
              onPress={openProfile}
              disabled={!vendor && !personId}
              style={styles.who}
            >
              {teller.avatarUrl ? (
                <Image
                  source={{ uri: teller.avatarUrl }}
                  contentFit="cover"
                  accessible={false}
                  style={styles.avatar}
                />
              ) : (
                <View style={[styles.avatar, styles.avatarPlain]}>
                  {vendor ? (
                    <Icon name="storefront-outline" size={18} color="#FFFFFF" />
                  ) : (
                    <AppText variant="caption" weight={700} color="onPhoto">
                      {initials(name)}
                    </AppText>
                  )}
                </View>
              )}
              <View style={styles.whoText}>
                <View style={styles.nameRow}>
                  <AppText
                    weight={600}
                    color="onPhoto"
                    numberOfLines={1}
                    style={[styles.shrink, styles.shadowed]}
                  >
                    {teller.isMine ? t('stories.yours') : name}
                  </AppText>
                  {teller.isSample && (
                    <View style={styles.tag} accessible accessibilityLabel={t('sample.label')}>
                      <AppText variant="caption" weight={700} color="onPhoto">
                        {t('sample.tag')}
                      </AppText>
                    </View>
                  )}
                </View>
                {subtitle ? (
                  <AppText
                    variant="caption"
                    color="onPhoto"
                    numberOfLines={1}
                    style={[styles.soft, styles.shadowed]}
                  >
                    {subtitle}
                  </AppText>
                ) : null}
              </View>
            </Pressable>
            {paused && <Icon name="pause" size={18} color="#FFFFFF" />}
            {teller.live && !teller.isMine && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('reels.more')}
                onPress={more}
                hitSlop={8}
                style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
              >
                <Icon name="ellipsis-horizontal" size={22} color="#FFFFFF" />
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('story.close')}
              onPress={close}
              hitSlop={8}
              style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
            >
              <Icon name="close" size={22} color="#FFFFFF" weight="semibold" />
            </Pressable>
          </View>
        </View>

        <View
          style={[
            styles.bottom,
            bottomShade,
            { paddingBottom: Math.max(insets.bottom, Spacing.lg) },
          ]}
        >
          {slide.caption && (
            <AppText color="onPhoto" numberOfLines={3} style={styles.caption}>
              {slide.caption}
            </AppText>
          )}
          {teller.isMine ? (
            <View style={styles.actions}>
              <Button
                icon="add-circle-outline"
                label={t('stories.add')}
                onPress={() => leaveFor(() => router.push('/post-story'))}
                style={styles.ask}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('stories.delete')}
                onPress={deleteStory}
                disabled={remove.isPending}
                style={({ pressed }) => [styles.round, pressed && styles.closePressed]}
              >
                <Icon name="trash-outline" size={22} color="#FFFFFF" />
              </Pressable>
            </View>
          ) : vendor ? (
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  saved ? t('vendorCard.unsave', { name }) : t('vendorCard.save', { name })
                }
                onPress={() => {
                  if (!saved) saveHaptic();
                  toggleSave(vendor.id);
                }}
                style={({ pressed }) => [styles.round, pressed && styles.closePressed]}
              >
                <Icon name={saved ? 'heart' : 'heart-outline'} size={24} color="#FFFFFF" />
              </Pressable>
              <Button
                label={t('vendor.ask')}
                onPress={() =>
                  leaveFor(() => router.push({ pathname: '/ask', params: { vendorId: vendor.id } }))
                }
                style={styles.ask}
              />
              {/* A vendor's photos carry their city for the shared line; stories don't */}
              {!teller.live && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('discover.shareLabel', { name })}
                  onPress={() => void shareVendor({ name, ...vendor }, t)}
                  style={({ pressed }) => [styles.round, pressed && styles.closePressed]}
                >
                  <Icon name="paper-plane-outline" size={22} color="#FFFFFF" />
                </Pressable>
              )}
            </View>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

/** One clip: plays once with its progress bar, then hands on to the next. */
function StoryVideo({
  url,
  paused,
  progress,
  onEnd,
  label,
}: {
  url: string;
  paused: boolean;
  progress: SharedValue<number>;
  onEnd: () => void;
  label: string;
}) {
  const player = useVideoPlayer(url, (p) => {
    p.muted = MUTED;
    p.timeUpdateEventInterval = 0.1;
  });
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    if (player.duration > 0) {
      progress.set(
        withTiming(Math.min(1, currentTime / player.duration), {
          duration: 100,
          easing: Easing.linear,
        }),
      );
    }
  });
  useEventListener(player, 'playToEnd', onEnd);
  // A clip that won't load is skipped rather than leaving a black screen
  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'error') onEnd();
  });
  useEffect(() => {
    if (paused) player.pause();
    else player.play();
  }, [paused, player]);
  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
      allowsPictureInPicture={false}
      surfaceType="textureView"
      accessible
      accessibilityLabel={label}
    />
  );
}

const useStyles = makeStyles((Colors) => ({
  screen: {
    flex: 1,
    backgroundColor: Colors.viewer,
  },
  stage: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: Colors.viewer,
  },
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  zones: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  zonePrev: {
    flex: 1,
  },
  zoneNext: {
    flex: 2,
  },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  bars: {
    flexDirection: 'row',
    gap: 4,
  },
  track: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  bar: {
    height: 3,
    backgroundColor: '#FFFFFF',
  },
  barFull: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  who: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: Sizes.tapTarget,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  avatarPlain: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(138, 28, 51, 0.9)',
  },
  whoText: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  shrink: {
    flexShrink: 1,
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  soft: {
    opacity: 0.9,
  },
  // Text over photos gets a soft shadow so it reads on bright ones too.
  shadowed: {
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(120, 120, 128, 0.36)',
  },
  closePressed: {
    backgroundColor: 'rgba(120, 120, 128, 0.56)',
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xxxl * 2,
  },
  caption: {
    paddingHorizontal: Spacing.xs,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  round: {
    width: Sizes.button,
    height: Sizes.button,
    borderRadius: Sizes.button / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(120, 120, 128, 0.36)',
  },
  ask: {
    flex: 1,
  },
}));
