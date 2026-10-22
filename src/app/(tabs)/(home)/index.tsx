import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { NavBar, useNavScroll, useNavTop } from '@/components/nav';
import { SearchButton } from '@/components/search-button';
import { StateView } from '@/components/state-view';
import { useBottomSpace } from '@/components/tab-bar';
import { Sizes, Spacing, useColors } from '@/constants/theme';
import { useIsVendor } from '@/data/chat';
import { useFeed, type FeedPost } from '@/data/feed';
import { useCategoryGroups, useHomeEvents } from '@/data/reference';
import { useSession } from '@/features/auth/session';
import { ChatButton } from '@/features/chat/chat-button';
import { BookFirst } from '@/features/home/book-first-row';
import { DateCard } from '@/features/home/date-card';
import { EventCarousel } from '@/features/home/event-carousel';
import { NextUp } from '@/features/home/next-up';
import { SectionHeader } from '@/features/home/section-header';
import { VendorPhotoCards } from '@/features/home/vendor-photo-cards';
import { VendorRows } from '@/features/home/vendor-rows';
import { useWeddingDraft } from '@/features/home/wedding-draft';
import { VendorTypeRow } from '@/features/home/vendor-type-row';
import { YourFamily } from '@/features/home/your-family';
import { YourVendors } from '@/features/home/your-vendors';
import { LocationChip } from '@/features/location/location-chip';
import { findForPlan } from '@/features/planner/find-for-plan';
import { usePlanView } from '@/features/planner/use-plan-view';
import { WebsiteCard } from '@/features/website/website-card';
import { StoryRings } from '@/features/stories/story-rings';
import { WedHomeSection } from '@/features/wed/home-wed';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

/**
 * S4 Home is the family's wedding, not a catalog, in the Journey look: a
 * greeting, then the wedding card (OmbreBackground; with a plan it counts down
 * to the plan's date and opens My Wedding, before one it asks when the wedding
 * is, no account needed), then search, then what to do next, where things
 * stand with each vendor, vendors free on their date, and what the family has
 * been up to. Before there's a plan: what to book first (sharper once they've
 * answered), the kinds of vendor and the events.
 */
export default function HomeScreen() {
  const Colors = useColors();
  const { t } = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const scroll = useNavScroll();
  const navTop = useNavTop();
  const bottom = useBottomSpace();
  const view = usePlanView();
  const feed = useFeed();
  const posts = feed.data ?? [];
  const [refreshing, setRefreshing] = useState(false);
  const { wedding, loading, plan, events, next } = view;
  const planning = !!wedding || (loading && !!plan.syncedWeddingId);
  // A vendor account that isn't planning a wedding gets no "Plan your wedding"
  // cover (their My business card comes first instead), and nor does someone
  // who joined just looking: they came to browse, not to be asked to plan
  const { isVendor } = useIsVendor();
  const { profile } = useSession();
  const browsing = !isVendor && profile?.joined_as !== 'looking';
  // The wedding card: the plan's countdown, or before a plan, asking for the date
  const showDateCard = !planning && !loading && browsing;

  // The small title and the bar's backdrop come in as the greeting scrolls away
  const [greetingHeight, setGreetingHeight] = useState(0);
  useEffect(() => scroll.setCollapseAt(greetingHeight), [scroll, greetingHeight]);

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
    <View style={[styles.screen, { backgroundColor: Colors.canvas }]}>
      <Animated.ScrollView
        onScroll={scroll.onScroll}
        scrollEventThrottle={16}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingBottom: bottom }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.text2}
            colors={[Colors.primary]}
            progressViewOffset={navTop}
          />
        }
      >
        <View style={[styles.body, { paddingTop: navTop + Spacing.md }]}>
          <View
            style={styles.greeting}
            onLayout={(event) => setGreetingHeight(event.nativeEvent.layout.height)}
          >
            <AppText variant="label" weight={600} color="text2">
              {profile?.full_name
                ? t('home.hello', { name: profile.full_name.split(' ')[0] })
                : t('home.helloPlain')}
            </AppText>
            <AppText variant="title">{t('home.yourWedding')}</AppText>
          </View>
          {planning ? <DateCard planDate={plan.weddingDate} /> : showDateCard && <DateCard />}
          {/* The wedding website, easy to find (DECISIONS.md, 2026-10-22) */}
          {wedding && <WebsiteCard weddingId={wedding.id} canEdit={view.canEdit} />}
          <StoryRings />
          <View style={styles.find}>
            <SearchButton
              onPress={() => router.navigate({ pathname: '/search', params: { focus: '1' } })}
            />
            <LocationChip />
          </View>
          {/* MOCKUP: Wed's cards waiting for a yes, what it's working on, or a way in.
              Only with a plan: its cards book things for a sample family's wedding */}
          {planning && <WedHomeSection />}

          {planning ? (
            <>
              <NextUp view={view} />
              <YourVendors wedding={wedding} eventName={eventName} />
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

/** Home before there's a plan: what to book first, the kinds of vendor, and the events. */
function BrowseSections({ posts }: { posts: FeedPost[] }) {
  const { t } = useLocale();
  const router = useRouter();
  const { date } = useWeddingDraft();
  const groups = useCategoryGroups();
  const { data: sections, status, refetch } = useHomeEvents();

  return (
    <>
      <BookFirst />
      <VendorRows date={date} />

      <View style={styles.block}>
        <SectionHeader
          title={t('home.whatDoYouNeed')}
          link={t('home.seeAllTypes')}
          onLink={() => router.navigate('/search')}
        />
        {groups.isPending && <StateView state="loading" />}
        {groups.isError && <StateView state="error" onRetry={() => void groups.refetch()} />}
        {groups.data && <VendorTypeRow groups={groups.data} />}
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
    gap: Spacing.xs,
  },
  greeting: {
    gap: 2,
    marginBottom: -Spacing.md,
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
