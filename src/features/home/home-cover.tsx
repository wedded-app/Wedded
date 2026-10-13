import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { ProgressRing } from '@/components/progress-ring';
import { WeddingReel } from '@/components/wedding-reel';
import { makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import type { FeedPost } from '@/data/feed';
import { useSession } from '@/features/auth/session';
import { formatDate } from '@/features/inquiry/inquiry-helpers';
import { useStartPlanning } from '@/features/onboarding/start';
import { gradient } from '@/features/planner/countdown-card';
import { daysUntil } from '@/features/planner/plan';
import type { usePlanView } from '@/features/planner/use-plan-view';
import { useLocale } from '@/i18n/locale-context';
import { Motion } from '@/lib/motion';
import { useCountUp } from '@/lib/use-count-up';

import { Aurora } from './aurora';
import { heroPhoto } from './home-feed';

/** Most of the first screen, never cramped and never all of it on a tall phone. */
export function useCoverHeight() {
  const { height } = useWindowDimensions();
  return Math.round(Math.min(Math.max(height * 0.6, 440), 640));
}

// Dark at the top for the clock and the glass buttons, clear through the
// middle, and dark again behind the words at the bottom
const SCRIM =
  'linear-gradient(to bottom, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0) 26%, rgba(0,0,0,0) 42%, rgba(0,0,0,0.78) 100%)';
const scrim = (
  Platform.OS === 'web' ? { backgroundImage: SCRIM } : { experimental_backgroundImage: SCRIM }
) as ViewStyle;

type PlanView = ReturnType<typeof usePlanView>;

/**
 * The top of Home, edge to edge under the status bar. With a wedding in the
 * account it's that wedding: a photo (a vendor they booked, else a local
 * venue) slowly drifting closer, the countdown, the date and a ring that
 * fills as essentials are booked; the whole thing opens My Wedding. Before
 * there's a plan it's the welcome screen's weddings playing, with Plan your
 * wedding. While the account loads with nothing to stand in, it's the plain
 * maroon card, so nothing flashes.
 */
export function HomeCover({ view, posts }: { view: PlanView; posts: FeedPost[] }) {
  const Colors = useColors();
  const height = useCoverHeight();
  const { wedding, loading, plan } = view;

  // While the account loads, the phone's copy of its plan (if any) stands in
  if (wedding || (loading && plan.syncedWeddingId)) {
    return <WeddingCover height={height} view={view} posts={posts} />;
  }
  if (loading) return <View style={[styles.cover, { height }, gradient(Colors)]} />;
  return <StartCover height={height} />;
}

function WeddingCover({
  height,
  view,
  posts,
}: {
  height: number;
  view: PlanView;
  posts: FeedPost[];
}) {
  const Colors = useColors();
  const local = useStyles();
  const { t } = useLocale();
  const { plan, wedding, chosen, progress, canEdit, isPending } = view;
  const days = plan.weddingDate ? daysUntil(plan.weddingDate) : null;
  const counting = days !== null && days >= 0;
  const shownDays = useCountUp(counting ? days : 0);
  const share = progress.total > 0 ? progress.done / progress.total : 0;
  const booked = Object.values(wedding?.bookedVendors ?? {}).map((vendor) => vendor.slug);
  const photo = heroPhoto(posts, booked);

  return (
    <View style={[styles.cover, { height }, gradient(Colors)]}>
      {photo ? <DriftingPhoto url={photo.url} blurhash={photo.blurhash} /> : <Aurora size={340} />}
      <View style={[StyleSheet.absoluteFill, scrim]} />

      <Animated.View entering={Motion.rise} style={local.bottom}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('planner.title')}
          onPress={() => router.push('/plan')}
          pressedScale={0.98}
          style={local.words}
        >
          <View style={local.eyebrow}>
            <AppText variant="label" weight={700} color="onHero2" numberOfLines={1}>
              {(wedding?.title || t('planner.yourWedding')).toUpperCase()}
            </AppText>
            <Icon name="chevron-forward" size={15} color={Colors.onHero2} weight="semibold" />
          </View>

          <View style={local.row}>
            <View style={local.grow}>
              {counting && plan.weddingDate ? (
                <>
                  <View style={local.countRow}>
                    <AppText
                      weight={800}
                      color="onHero"
                      style={local.count}
                      maxFontSizeMultiplier={1.3}
                    >
                      {String(shownDays)}
                    </AppText>
                    <AppText variant="heading" weight={600} color="onHero2">
                      {t('planner.days', { count: days })}
                    </AppText>
                  </View>
                  <AppText variant="bodyLg" weight={600} color="onHero">
                    {formatDate(plan.weddingDate)}
                  </AppText>
                </>
              ) : days !== null ? (
                <AppText variant="title" weight={800} color="onHero">
                  {t('planner.married')}
                </AppText>
              ) : (
                <View style={local.askDate}>
                  <AppText variant="title" weight={800} color="onHero">
                    {t('planner.whenTitle')}
                  </AppText>
                  <AppText weight={600} color="onHero2">
                    {t('planner.pickDate')} ›
                  </AppText>
                </View>
              )}
            </View>

            {chosen.length > 0 && progress.total > 0 && (
              <View
                accessible
                accessibilityLabel={t('planner.progress', {
                  done: progress.done,
                  total: progress.total,
                })}
                style={local.ring}
              >
                <ProgressRing
                  value={share}
                  size={92}
                  color={Colors.onHero}
                  trackColor={Colors.heroTrack}
                >
                  <AppText weight={800} color="onHero" maxFontSizeMultiplier={1.2}>
                    {`${progress.done}/${progress.total}`}
                  </AppText>
                </ProgressRing>
                <AppText variant="caption" weight={600} color="onHero2" maxFontSizeMultiplier={1.3}>
                  {t('home.booked')}
                </AppText>
              </View>
            )}
          </View>
        </PressableScale>

        {!isPending && chosen.length === 0 && canEdit && (
          <PressableScale
            accessibilityRole="button"
            onPress={() => router.push('/plan-events')}
            style={local.pill}
          >
            <Icon name="sparkles" size={20} color={Colors.heroFrom} />
            <AppText variant="button" weight={700} style={{ color: Colors.heroFrom }}>
              {t('planner.chooseEvents')}
            </AppText>
          </PressableScale>
        )}
      </Animated.View>
    </View>
  );
}

/** Before there's a plan: weddings playing, and the way in. */
function StartCover({ height }: { height: number }) {
  const Colors = useColors();
  const local = useStyles();
  const { t } = useLocale();
  const { status } = useSession();
  const startPlanning = useStartPlanning();

  return (
    <View style={[styles.cover, { height }, gradient(Colors)]}>
      <WeddingReel />
      <View style={[StyleSheet.absoluteFill, scrim]} />
      <Animated.View entering={Motion.rise} style={local.bottom}>
        <View style={local.words}>
          <AppText variant="display" weight={800} color="onHero" serif accessibilityRole="header">
            {t('planner.startCardTitle')}
          </AppText>
          <AppText variant="bodyLg" color="onHero2">
            {t('planner.startCardBody')}
          </AppText>
        </View>
        <PressableScale
          accessibilityRole="button"
          onPress={startPlanning}
          pressedScale={0.96}
          style={local.pill}
        >
          <AppText variant="button" weight={700} style={{ color: Colors.heroFrom }}>
            {status === 'signedIn' ? t('planner.startPlanning') : t('planner.signInToPlan')}
          </AppText>
        </PressableScale>
      </Animated.View>
    </View>
  );
}

/** The cover photo, edging closer and back over a long breath; still with Reduce Motion. */
function DriftingPhoto({ url, blurhash }: { url: string; blurhash: string | null }) {
  const reduceMotion = useReducedMotion();
  const zoom = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    zoom.set(
      withRepeat(
        withTiming(1.08, { duration: 16000, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      ),
    );
  }, [reduceMotion, zoom]);

  const drift = useAnimatedStyle(() => ({ transform: [{ scale: zoom.value }] }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, drift]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <Image
        source={{ uri: url }}
        placeholder={blurhash ? { blurhash } : undefined}
        contentFit="cover"
        transition={400}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cover: {
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
});

const useStyles = makeStyles((Colors) => ({
  bottom: {
    gap: Spacing.lg,
    paddingHorizontal: Sizes.pageGutter + Spacing.xs,
    paddingBottom: Spacing.xl,
  },
  words: {
    gap: Spacing.sm,
  },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.lg,
  },
  grow: {
    flex: 1,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    columnGap: Spacing.sm,
  },
  count: {
    fontSize: 76,
    lineHeight: 84,
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  askDate: {
    gap: Spacing.xs,
  },
  ring: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    minHeight: Sizes.button,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.button,
    backgroundColor: Colors.onHero,
  },
}));
