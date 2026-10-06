import { Image } from 'expo-image';
import { router } from 'expo-router';
import {
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { eventIcon } from '@/components/event-icon';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { makeStyles, Radius, Sizes, Spacing, useColors, type Palette } from '@/constants/theme';
import type { FeedPost } from '@/data/feed';
import type { HomeEvent, HomeSection } from '@/data/reference';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { Motion } from '@/lib/motion';

const PHASE_LABELS: Partial<Record<string, string>> = {
  before: 'home.phases.before',
  wedding_day: 'home.phases.weddingDay',
  after: 'home.phases.after',
};

// Each part of the wedding has its own shade of the brand: rose before,
// saffron into maroon on the day, deep maroon after
const fill = (Colors: Palette, phase: string) => {
  const [from, to] =
    phase === 'wedding_day'
      ? [Colors.kesari, Colors.heroFrom]
      : phase === 'after'
        ? [Colors.heroFrom, '#4A0F1E']
        : [Colors.heroTo, Colors.heroFrom];
  const image = `linear-gradient(160deg, ${from} 0%, ${to} 100%)`;
  return (
    Platform.OS === 'web' ? { backgroundImage: image } : { experimental_backgroundImage: image }
  ) as ViewStyle;
};

const scrim = (
  Platform.OS === 'web'
    ? { backgroundImage: 'linear-gradient(to top, rgba(0,0,0,0.75), rgba(0,0,0,0.1))' }
    : {
        experimental_backgroundImage: 'linear-gradient(to top, rgba(0,0,0,0.75), rgba(0,0,0,0.1))',
      }
) as ViewStyle;

/**
 * "Plan by event" as tall cards that snap as you swipe, in ceremony order.
 * Each shows the event's name written large in Gurmukhi behind its name in
 * the family's language, how many kinds of vendor it needs and how many
 * vendors there are, on a shade for its part of the wedding (or a photo from
 * that event once vendors have one). Only the family's main events.
 */
export function EventCarousel({ sections, posts }: { sections: HomeSection[]; posts: FeedPost[] }) {
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(280, Math.round(width * 0.64));
  const events = sections
    .filter((section) => section.phase !== 'whole_wedding')
    .flatMap((section) =>
      section.events
        .filter((event) => event.isCore)
        .map((event) => ({ event, phase: section.phase })),
    );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={cardWidth + Spacing.md}
      decelerationRate="fast"
      contentContainerStyle={styles.strip}
      style={styles.bleed}
    >
      {events.map(({ event, phase }, index) => (
        <EventCard
          key={event.slug}
          event={event}
          phase={phase}
          index={index}
          width={cardWidth}
          photo={photoFor(event.slug, posts)}
        />
      ))}
    </ScrollView>
  );
}

function photoFor(eventSlug: string, posts: FeedPost[]): string | null {
  for (const post of posts) {
    const photo = post.photos.find((p) => p.eventSlug === eventSlug);
    if (photo) return photo.url.small;
  }
  return null;
}

function EventCard({
  event,
  phase,
  index,
  width,
  photo,
}: {
  event: HomeEvent;
  phase: string;
  index: number;
  width: number;
  photo: string | null;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const { t, locale } = useLocale();
  const name = localized(event.name, locale);
  const detail = [
    t('counts.vendorTypes', { count: event.vendorTypeCount }),
    t('counts.vendors', { count: event.vendorCount }),
  ].join(' · ');
  const phaseLabel = PHASE_LABELS[phase];
  // The name in Gurmukhi as a backdrop; in Punjabi mode, the English one
  const backdrop = locale === 'pa' ? event.name.en : event.name.pa;

  return (
    <Animated.View entering={Motion.stagger(index)}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${detail}`}
        onPress={() => router.push({ pathname: '/e/[slug]', params: { slug: event.slug } })}
        style={[styles.card, { width }, photo ? styles.photoCard : fill(Colors, phase)]}
      >
        {photo && (
          <>
            <Image source={{ uri: photo }} contentFit="cover" style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, scrim]} />
          </>
        )}
        {backdrop ? (
          <AppText
            aria-hidden
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            numberOfLines={1}
            ellipsizeMode="clip"
            maxFontSizeMultiplier={1}
            weight={800}
            style={styles.backdrop}
          >
            {backdrop}
          </AppText>
        ) : null}

        <View style={styles.topRow}>
          <View style={styles.iconWrap}>
            <Icon name={eventIcon(event.slug)} size={24} color={Colors.onHero} />
          </View>
          {phaseLabel && (
            <View style={styles.phasePill}>
              <AppText variant="caption" weight={600} color="onHero">
                {t(phaseLabel)}
              </AppText>
            </View>
          )}
        </View>

        <View style={styles.words}>
          <AppText variant="title" weight={800} color="onHero" numberOfLines={2}>
            {name}
          </AppText>
          <AppText variant="label" weight={500} color="onHero2" numberOfLines={2}>
            {detail}
          </AppText>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

const useStyles = makeStyles((Colors) => ({
  bleed: {
    marginHorizontal: -Sizes.pageGutter,
  },
  strip: {
    gap: Spacing.md,
    paddingHorizontal: Sizes.pageGutter,
  },
  card: {
    height: 236,
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderRadius: Radius.card + 4,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  photoCard: {
    backgroundColor: Colors.heroFrom,
  },
  backdrop: {
    position: 'absolute',
    right: -12,
    bottom: 52,
    fontSize: 104,
    lineHeight: 150,
    color: 'rgba(255,255,255,0.13)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  phasePill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.chip,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  words: {
    gap: Spacing.xs,
  },
}));
