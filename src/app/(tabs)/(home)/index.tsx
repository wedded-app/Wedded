import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { runOnJS, useAnimatedReaction } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { NavBar, useNavScroll, useNavTop } from '@/components/nav';
import { SearchButton } from '@/components/search-button';
import { StateView } from '@/components/state-view';
import { useBottomSpace } from '@/components/tab-bar';
import { Sizes, Spacing, useColors, useScheme } from '@/constants/theme';
import { useIsVendor } from '@/data/chat';
import { useFeed, type FeedPost } from '@/data/feed';
import { useCategoryGroups, useHomeEvents } from '@/data/reference';
import { useCategoryVendorCounts } from '@/data/vendors';
import { BusinessHomeCard } from '@/features/business/business-home-card';
import { ChatButton } from '@/features/chat/chat-button';
import { EventCarousel } from '@/features/home/event-carousel';
import { HomeCover, useCoverHeight } from '@/features/home/home-cover';
import { NextUp } from '@/features/home/next-up';
import { PostRequestCard } from '@/features/requests/post-request-card';
import { SectionHeader } from '@/features/home/section-header';
import { VendorPhotoCards } from '@/features/home/vendor-photo-cards';
import { BENTO_TILES, VendorTypeBento } from '@/features/home/vendor-type-bento';
import { YourFamily } from '@/features/home/your-family';
import { YourVendors } from '@/features/home/your-vendors';
import { LocationChip } from '@/features/location/location-chip';
import { findForPlan } from '@/features/planner/find-for-plan';
import { usePlanView } from '@/features/planner/use-plan-view';
import { WedHomeSection } from '@/features/wed/home-wed';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

/**
 * S4 Home is the family's wedding, not a catalog. Edge to edge at the top,
 * the wedding itself (countdown and a ring that fills as they book), then
 * search, then what to do next, where things stand with each vendor, vendors
 * free on their date, and what the family has been up to. Before there's a
 * plan it's weddings playing with Plan your wedding, then popular vendors,
 * the kinds of vendor and the events, so there's still plenty to look at.
 * Vendor accounts get their My business card first, under the cover.
 */
export default function HomeScreen() {
  const Colors = useColors();
  const scheme = useScheme();
  const { t } = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const scroll = useNavScroll();
  const navTop = useNavTop();
  const coverHeight = useCoverHeight();
  const bottom = useBottomSpace();
  const view = usePlanView();
  const feed = useFeed();
  const posts = feed.data ?? [];
  const [refreshing, setRefreshing] = useState(false);
  const { wedding, loading, plan, events, next } = view;
  const planning = !!wedding || (loading && !!plan.syncedWeddingId);
  // A vendor account that isn't planning a wedding gets no "Plan your wedding"
  // cover: their My business card comes first instead
  const { isVendor } = useIsVendor();
  const showCover = planning || !isVendor;

  // The small title and the bar's backdrop come in as the cover scrolls away
  const collapseAt = showCover ? coverHeight - navTop : 0;
  useEffect(() => scroll.setCollapseAt(collapseAt), [scroll, collapseAt]);

  // White clock and battery over the cover, the app's own once it's gone.
  // Worklets may capture only shared values, never the whole scroll object.
  const { scrollY } = scroll;
  const [overCover, setOverCover] = useState(true);
  useAnimatedReaction(
    () => scrollY.value < collapseAt,
    (now, before) => {
      if (now !== before) runOnJS(setOverCover)(now);
    },
  );
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(overCover || scheme === 'dark' ? 'light' : 'dark');
      return () => setStatusBarStyle(scheme === 'dark' ? 'light' : 'dark');
    }, [overCover, scheme]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await queryClient.refetchQueries({ type: 'active' });
    setRefreshing(false);
  }

  const eventName = (slug: string) =>
    localized(events.find((event) => event.slug === slug)?.name ?? { en: slug });
  const first = next[0];
  const findFirst = () =>
    first
      ? findForPlan(
          first.need.categorySlug,
          first.need.groupSlug,
          first.eventSlug,
          plan.guests?.[first.eventSlug],
        )
      : router.navigate('/search');

  return (
    <View style={[styles.screen, { backgroundColor: Colors.bg }]}>
      <Animated.ScrollView
        onScroll={scroll.onScroll}
        scrollEventThrottle={16}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingBottom: bottom }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.onHero}
            colors={[Colors.primary]}
            progressViewOffset={navTop}
          />
        }
      >
        {showCover && <HomeCover view={view} posts={posts} />}

        <View style={[styles.body, !showCover && { paddingTop: navTop + Spacing.lg }]}>
          {/* Vendor accounts: their business first (families never see it) */}
          <BusinessHomeCard />
          <View style={styles.find}>
            <SearchButton
              onPress={() => router.navigate({ pathname: '/search', params: { focus: '1' } })}
            />
            <LocationChip />
          </View>
          {/* MOCKUP: Wed's cards waiting for a yes, what it's working on, or a way in */}
          <WedHomeSection />

          {planning ? (
            <>
              <NextUp view={view} />
              <PostRequestCard />
              <YourVendors wedding={wedding} eventName={eventName} onFind={findFirst} />
              {first ? (
                <VendorPhotoCards
                  title={
                    plan.weddingDate
                      ? t('home.freeOnDateTitle', { type: localized(first.need.name) })
                      : t('home.nearYouTitle', { type: localized(first.need.name) })
                  }
                  link={t('home.seeAll')}
                  onLink={findFirst}
                  categorySlug={first.need.categorySlug}
                  groupSlug={first.need.groupSlug}
                  eventSlug={first.eventSlug}
                  date={plan.weddingDate}
                  guestBand={plan.guests?.[first.eventSlug]}
                />
              ) : (
                <VendorPhotoCards title={t('home.popularNearYou')} />
              )}
              {wedding && <YourFamily weddingId={wedding.id} eventName={eventName} />}
            </>
          ) : loading ? null : (
            <BrowseSections posts={posts} />
          )}

          <View style={styles.footer}>
            <FooterLink
              label={t('home.foundingWall')}
              onPress={() => router.push('/founding')}
              strong
            />
            <FooterLink label={t('home.forVendors')} onPress={() => router.push('/for-vendors')} />
          </View>
        </View>
      </Animated.ScrollView>

      <NavBar scroll={scroll} title={t('app.name')} back={false} trailing={<ChatButton />} />
    </View>
  );
}

/** Home before there's a plan: popular vendors, the kinds of vendor, and the events. */
function BrowseSections({ posts }: { posts: FeedPost[] }) {
  const { t } = useLocale();
  const router = useRouter();
  const groups = useCategoryGroups();
  const counts = useCategoryVendorCounts();
  const { data: sections, status, refetch } = useHomeEvents();

  return (
    <>
      <VendorPhotoCards title={t('home.popularNearYou')} />

      <View style={styles.block}>
        <SectionHeader
          title={t('home.whatDoYouNeed')}
          link={(groups.data?.length ?? 0) > BENTO_TILES ? t('home.seeAllTypes') : t('home.seeAll')}
          onLink={() => router.navigate('/search')}
        />
        {groups.isPending && <StateView state="loading" />}
        {groups.isError && <StateView state="error" onRetry={() => void groups.refetch()} />}
        {groups.data && (
          <VendorTypeBento groups={groups.data} counts={counts.data ?? {}} posts={posts} />
        )}
      </View>

      <View style={styles.block}>
        <SectionHeader title={t('home.planByEvent')} />
        {status === 'pending' && <StateView state="loading" />}
        {status === 'error' && <StateView state="error" onRetry={() => void refetch()} />}
        {status === 'success' && sections.length === 0 && (
          <StateView state="empty" icon="calendar-outline" message={t('home.empty')} />
        )}
        {sections && sections.length > 0 && <EventCarousel sections={sections} posts={posts} />}
      </View>
    </>
  );
}

function FooterLink({
  label,
  onPress,
  strong = false,
}: {
  label: string;
  onPress: () => void;
  strong?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      style={({ pressed }) => [styles.footerLink, pressed && styles.pressed]}
    >
      <AppText weight={strong ? 600 : 400} color={strong ? 'primary' : 'text2'}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  body: {
    gap: Spacing.xxl,
    paddingTop: Spacing.lg,
    paddingHorizontal: Sizes.pageGutter,
  },
  find: {
    gap: Spacing.md,
  },
  block: {
    gap: Spacing.md,
  },
  footer: {
    alignItems: 'center',
  },
  footerLink: {
    minHeight: Sizes.tapTarget,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  pressed: {
    opacity: 0.5,
  },
});
