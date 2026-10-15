import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { PanResponder, Platform, Pressable, View, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
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
import { useSavedVendors, useSaveVendor } from '@/data/saved';
import { markStorySeen } from '@/features/discover/seen-stories';
import { shareVendor } from '@/features/vendors/share';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { saveHaptic } from '@/lib/haptics';

const PHOTO_MS = 5000;
const CLOSE_DRAG = 120;

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

/**
 * The full-screen story viewer (opened from a story ring): a vendor's photos
 * one after another with progress bars along the top, like Instagram and
 * TikTok. Tap the right side for the next photo, the left for the one
 * before; hold to pause; swipe down or tap Close to leave. After the last
 * photo it moves on to the next vendor. /story?vendor={slug}&photo={photo id}
 */
export default function StoryScreen() {
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLocale();
  const reduceMotion = useReducedMotion();
  const { vendor: startSlug, photo: startPhoto } = useLocalSearchParams<{
    vendor?: string;
    photo?: string;
  }>();
  const feed = useFeed();
  const saves = useSavedVendors();
  const { toggleSave } = useSaveVendor();
  const posts = feed.data ?? [];

  const [position, setPosition] = useState<{ post: number; photo: number } | null>(null);
  const [paused, setPaused] = useState(false);
  const progress = useSharedValue(0);
  const zoom = useSharedValue(1);
  const dragY = useSharedValue(0);
  const elapsed = useRef(0);
  const startedAt = useRef(0);

  // Start at the story that was tapped, once the feed has loaded.
  const start = Math.max(
    0,
    posts.findIndex((post) => post.slug === startSlug),
  );
  // A highlight opens at its own photo.
  const startPhotoIndex = Math.max(
    0,
    posts[start]?.photos.findIndex((item) => item.id === startPhoto) ?? 0,
  );
  const current = position ?? { post: start, photo: startPhotoIndex };
  const post = posts[current.post];
  const photo = post?.photos[current.photo];

  const close = () => (router.canGoBack() ? router.back() : router.navigate('/discover'));

  // 1 next, -1 back, 0 close.
  const go = (step: 1 | -1 | 0) => {
    elapsed.current = 0;
    if (step === 0 || !post) {
      close();
      return;
    }
    const next = current.photo + step;
    if (next >= 0 && next < post.photos.length) {
      setPosition({ post: current.post, photo: next });
    } else if (step === 1 && current.post + 1 < posts.length) {
      setPosition({ post: current.post + 1, photo: 0 });
    } else if (step === -1 && current.post > 0) {
      setPosition({ post: current.post - 1, photo: 0 });
    } else if (step === 1) {
      close();
    }
  };
  // The timer and key handlers call the latest `go` without restarting.
  const goRef = useRef(go);
  useEffect(() => {
    goRef.current = go;
  });

  useEffect(() => {
    if (post) markStorySeen(post.vendorId);
  }, [post]);

  // Run the current photo's timer and its progress bar; pausing keeps the
  // time already watched.
  useEffect(() => {
    if (!photo) return;
    if (paused) {
      elapsed.current += Date.now() - startedAt.current;
      cancelAnimation(progress);
      cancelAnimation(zoom);
      return;
    }
    const remaining = Math.max(0, PHOTO_MS - elapsed.current);
    startedAt.current = Date.now();
    progress.value = elapsed.current / PHOTO_MS;
    progress.value = withTiming(1, { duration: remaining, easing: Easing.linear });
    if (!reduceMotion) {
      if (elapsed.current === 0) zoom.value = 1;
      zoom.value = withTiming(1.08, { duration: remaining, easing: Easing.linear });
    }
    const timer = setTimeout(() => goRef.current(1), remaining);
    return () => clearTimeout(timer);
  }, [photo, paused, progress, zoom, reduceMotion]);

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

  // Swipe down to close, the way stories and photo viewers dismiss.
  const [pan] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 12 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        dragY.value = Math.max(0, g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > CLOSE_DRAG) {
          close();
        } else {
          dragY.value = withSpring(0, Springs.snappy);
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

  if (feed.isPending || !post || !photo) {
    return (
      <View style={styles.screen}>
        <StatusBar style="light" />
        {feed.isPending ? (
          <StateView state="loading" />
        ) : (
          <StateView state="error" onRetry={() => void feed.refetch()} />
        )}
      </View>
    );
  }

  const name = localized(post.name);
  const category = post.category ? localized(post.category.name) : null;
  const caption = post.caption?.trim() || null;
  const saved = (saves.data ?? []).some((save) => save.vendorId === post.vendorId);

  const openProfile = () => {
    router.back();
    router.push({ pathname: '/v/[slug]', params: { slug: post.slug } });
  };

  return (
    <View style={styles.screen} {...pan.panHandlers}>
      <StatusBar style="light" />
      <Animated.View style={[styles.stage, dragStyle]}>
        <Animated.View style={[styles.fill, zoomStyle]}>
          <Image
            source={{ uri: photo.url.large }}
            placeholder={photo.blurhash ? { blurhash: photo.blurhash } : undefined}
            contentFit="cover"
            transition={180}
            accessible
            accessibilityLabel={t('discover.photoOf', {
              number: current.photo + 1,
              total: post.photos.length,
              name,
            })}
            style={styles.fill}
          />
        </Animated.View>

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
            {post.photos.map((item, i) => (
              <View key={item.id} style={styles.track}>
                {i < current.photo && <View style={[styles.bar, styles.barFull]} />}
                {i === current.photo && <Animated.View style={[styles.bar, barStyle]} />}
              </View>
            ))}
          </View>
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('story.viewProfile', { name })}
              onPress={openProfile}
              style={styles.who}
            >
              <Image
                source={{ uri: post.photos[0].url.small }}
                contentFit="cover"
                accessible={false}
                style={styles.avatar}
              />
              <View style={styles.whoText}>
                <AppText weight={600} color="onPhoto" numberOfLines={1} style={styles.shadowed}>
                  {name}
                </AppText>
                <AppText
                  variant="caption"
                  color="onPhoto"
                  numberOfLines={1}
                  style={[styles.soft, styles.shadowed]}
                >
                  {[category, post.city].filter(Boolean).join(' · ')}
                </AppText>
              </View>
            </Pressable>
            {paused && <Icon name="pause" size={18} color="#FFFFFF" />}
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
          {caption && (
            <AppText color="onPhoto" numberOfLines={2} style={styles.caption}>
              {caption}
            </AppText>
          )}
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                saved ? t('vendorCard.unsave', { name }) : t('vendorCard.save', { name })
              }
              onPress={() => {
                if (!saved) saveHaptic();
                toggleSave(post.vendorId);
              }}
              style={({ pressed }) => [styles.round, pressed && styles.closePressed]}
            >
              <Icon name={saved ? 'heart' : 'heart-outline'} size={24} color="#FFFFFF" />
            </Pressable>
            <Button
              label={t('vendor.ask')}
              onPress={() => {
                router.back();
                router.push({ pathname: '/ask', params: { vendorId: post.vendorId } });
              }}
              style={styles.ask}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('discover.shareLabel', { name })}
              onPress={() =>
                void shareVendor({ name, category, city: post.city, slug: post.slug }, t)
              }
              style={({ pressed }) => [styles.round, pressed && styles.closePressed]}
            >
              <Icon name="paper-plane-outline" size={22} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </View>
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
  whoText: {
    flex: 1,
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
