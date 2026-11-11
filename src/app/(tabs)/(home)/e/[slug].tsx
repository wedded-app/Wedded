import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { eventEmoji } from '@/components/event-icon';
import { groupIcon } from '@/components/group-icon';
import { Icon } from '@/components/icon';
import { SectionTitle } from '@/components/list';
import { NavScreen, useNavTop } from '@/components/nav';
import { PressableScale } from '@/components/pressable-scale';
import { StateView } from '@/components/state-view';
import { backgroundCss, makeStyles, Sizes, Spacing, useColors, useScheme } from '@/constants/theme';
import { useEvent, useEventNeeds, type EventNeed } from '@/data/reference';
import { EVENT_PHOTOS } from '@/features/home/event-photos';
import { hasDraftPlan, useWeddingDraft } from '@/features/home/wedding-draft';
import { useStartPlanning } from '@/features/onboarding/start';
import { usePlanView } from '@/features/planner/use-plan-view';
import { KindCircle } from '@/features/search/kind-circle';
import { KIND_PHOTOS } from '@/features/search/kind-photos';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';

// Headings for event_categories.importance; anything new shows without one.
const IMPORTANCE_HEADINGS: Partial<Record<string, string>> = {
  essential: 'event.essential',
  nice_to_have: 'event.niceToHave',
};

// Over the photo's top, so the clock and Back read on any photo
const TOP_SHADE = backgroundCss(
  'linear-gradient(to bottom, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0) 45%)',
);

/**
 * S5 Event page, an event's guide (redone 2026-11-11; Fezy: the grey rows
 * read like Settings). The event's photo across the top (EVENT_PHOTOS, or
 * its emoji), under Back; its name, when it usually happens and what it is;
 * then the vendors it needs as photos: the essentials in a grid of squares,
 * the nice-to-haves as a row of circles (the Vendors tab's KIND_PHOTOS, or
 * the group's icon). Each opens that kind's results for this event. Without
 * a plan, a card at the end starts one. Deep link: /e/{slug}.
 */
export default function EventScreen() {
  const { slug = '' } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const styles = useStyles();
  const { t } = useLocale();
  const { width } = useWindowDimensions();
  const navTop = useNavTop();
  const scheme = useScheme();
  const event = useEvent(slug);
  const needs = useEventNeeds(slug);
  const { wedding } = usePlanView();
  const draft = useWeddingDraft();
  const startPlanning = useStartPlanning();
  const planning = !!wedding || hasDraftPlan(draft);
  const title = event.data ? localized(event.data.name) : null;
  const photo = EVENT_PHOTOS[slug];
  const hero = Math.max(260, Math.round(width * 0.72));

  // White clock and battery over the photo; the app's own once it scrolls away
  const [pastTop, setPastTop] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(photo && !pastTop ? 'light' : scheme === 'dark' ? 'light' : 'dark');
      return () => setStatusBarStyle(scheme === 'dark' ? 'light' : 'dark');
    }, [photo, pastTop, scheme]),
  );

  const open = (need: EventNeed) =>
    router.push({
      pathname: '/c/[category]',
      params: { category: need.categorySlug, event: slug },
    });

  const retry = () => {
    void event.refetch();
    void needs.refetch();
  };

  let body;
  if (event.isPending || needs.isPending) {
    body = <StateView state="loading" />;
  } else if (event.isError || needs.isError) {
    body = <StateView state="error" onRetry={retry} />;
  } else if (!event.data) {
    body = (
      <StateView
        state="empty"
        icon="calendar-outline"
        message={t('event.notFound')}
        action={{ label: t('common.goHome'), onPress: () => router.navigate('/') }}
      />
    );
  } else {
    body = (
      <>
        <View style={styles.intro}>
          <AppText variant="display" weight={700} accessibilityRole="header" style={styles.title}>
            {title}
          </AppText>
          {event.data.timing && (
            <AppText variant="bodyLg" weight={500} color="text2">
              {localized(event.data.timing)}
            </AppText>
          )}
          {event.data.summary && (
            <AppText variant="bodyLg">{localized(event.data.summary)}</AppText>
          )}
        </View>

        <View style={styles.needs}>
          <SectionTitle>{t('event.needsTitle')}</SectionTitle>
          {needs.data.map((section) => {
            const heading = IMPORTANCE_HEADINGS[section.importance];
            return (
              <View key={section.importance} style={styles.section}>
                {heading && (
                  <AppText variant="caption" weight={600} color="text2" style={styles.caps}>
                    {t(heading)}
                  </AppText>
                )}
                {section.importance === 'nice_to_have' ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.bleed}
                    contentContainerStyle={styles.circles}
                  >
                    {section.needs.map((need) => (
                      <KindCircle
                        key={need.categorySlug}
                        kind={need}
                        size={72}
                        width={84}
                        onPress={() => open(need)}
                      />
                    ))}
                  </ScrollView>
                ) : (
                  <View style={styles.grid}>
                    {section.needs.map((need) => (
                      <Tile key={need.categorySlug} need={need} onPress={() => open(need)} />
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {!planning && (
          <View style={styles.plan}>
            <AppText variant="heading" weight={600}>
              {t('event.planTitle', { event: title ?? '' })}
            </AppText>
            <AppText color="text2">{t('event.planBody')}</AppText>
            <Button label={t('event.planStart')} onPress={startPlanning} />
          </View>
        )}
      </>
    );
  }

  return (
    <NavScreen
      title={null}
      navTitle={title ?? undefined}
      collapseAt={hero - navTop}
      onCollapsedChange={setPastTop}
    >
      <Hero slug={slug} photo={photo} height={hero} navTop={navTop} />
      {body}
    </NavScreen>
  );
}

/** The event's photo across the top, under the bar; its emoji on warm grey without one. */
function Hero({
  slug,
  photo,
  height,
  navTop,
}: {
  slug: string;
  photo: number | undefined;
  height: number;
  navTop: number;
}) {
  const styles = useStyles();
  return (
    <View
      style={[styles.hero, { height, marginTop: -navTop }]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {photo ? (
        <>
          <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" />
          <View style={[StyleSheet.absoluteFill, TOP_SHADE]} />
        </>
      ) : (
        <AppText style={styles.heroEmoji} maxFontSizeMultiplier={1}>
          {eventEmoji(slug)}
        </AppText>
      )}
    </View>
  );
}

/** One essential kind of vendor: a square photo (or its group's icon) and its name under it. */
function Tile({ need, onPress }: { need: EventNeed; onPress: () => void }) {
  const Colors = useColors();
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const name = localized(need.name);
  const photo = KIND_PHOTOS[need.categorySlug];
  // Three across the page, between the gutters
  const across = Math.floor((width - Sizes.pageGutter * 2 - GAP * 2) / 3);
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={name}
      pressedScale={0.96}
      onPress={() => {
        selectionHaptic();
        onPress();
      }}
      style={[styles.tile, { width: across }]}
    >
      <View style={styles.square}>
        {photo ? (
          <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <Icon name={groupIcon(need.groupSlug)} size={30} color={Colors.primary} />
        )}
      </View>
      <AppText variant="label" weight={600} numberOfLines={2}>
        {name}
      </AppText>
    </PressableScale>
  );
}

const GAP = Spacing.md;

const useStyles = makeStyles((Colors) => ({
  hero: {
    marginHorizontal: -Sizes.pageGutter,
    marginBottom: -Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  heroEmoji: {
    fontSize: 96,
    lineHeight: 112,
  },
  intro: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  title: {
    letterSpacing: -0.5,
  },
  needs: {
    gap: Spacing.lg,
  },
  section: {
    gap: Spacing.md,
  },
  caps: {
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: Spacing.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: GAP,
    rowGap: Spacing.lg,
  },
  tile: {
    gap: Spacing.sm,
  },
  square: {
    aspectRatio: 1,
    borderRadius: 18,
    borderCurve: 'continuous',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.sand,
  },
  bleed: {
    marginHorizontal: -Sizes.pageGutter,
  },
  circles: {
    gap: Spacing.sm,
    paddingHorizontal: Sizes.pageGutter - Spacing.xs,
  },
  plan: {
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: 24,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
}));
