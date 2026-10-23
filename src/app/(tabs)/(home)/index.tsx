import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { NavBar, useNavScroll, useNavTop } from '@/components/nav';
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
import { EventsRow } from '@/features/home/events-row';
import { greetingKey, todayLine } from '@/features/home/greeting';
import { NextUp } from '@/features/home/next-up';
import { SectionHeader } from '@/features/home/section-header';
import { VendorPhotoCards } from '@/features/home/vendor-photo-cards';
import { VendorRows } from '@/features/home/vendor-rows';
import { useWeddingDraft } from '@/features/home/wedding-draft';
import { VendorTypeRow } from '@/features/home/vendor-type-row';
import { YourFamily } from '@/features/home/your-family';
import { ProfileButton } from '@/features/settings/profile-button';
import { findForPlan } from '@/features/planner/find-for-plan';
import { usePlanView } from '@/features/planner/use-plan-view';
import { WebsiteCard } from '@/features/website/website-card';
import { WedLine } from '@/features/wed/wed-line';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

/**
 * S4 Home answers one question: what should we do next? (the final look,
 * 2026-10-23; canvas board "2 · Home"). Its parts, always in this order:
 * today's date and a greeting, with chat and your initial (Profile) at the
 * top right; the wedding card (OmbreBackground; with a plan it counts down
 * and opens My Wedding, before one it asks when the wedding is); Wed's line,
 * only when Wed needs an OK; Up next, one ticket at a time; your events,
 * each saying in words what it still needs; vendors free on your dates; the
 * website; and what the family has been up to. No booked counts. Before
 * there's a plan: what to book first, the kinds of vendor and the events.
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
            <AppText variant="caption" weight={600} color="text2" style={styles.caps}>
              {todayLine(new Date())}
            </AppText>
            <AppText variant="title">
              {profile?.full_name
                ? t(greetingKey(new Date()), { name: profile.full_name.split(' ')[0] })
                : t(`${greetingKey(new Date())}Plain`)}
            </AppText>
          </View>
          {planning ? <DateCard planDate={plan.weddingDate} /> : showDateCard && <DateCard />}
          {/* MOCKUP: Wed's cards waiting for a yes, as one line. Only with a plan */}
          {planning && <WedLine />}

          {planning ? (
            <>
              <NextUp view={view} />
              <EventsRow view={view} />
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
              {/* The wedding website (DECISIONS.md, 2026-10-22), after the vendors */}
              {wedding && <WebsiteCard weddingId={wedding.id} canEdit={view.canEdit} />}
              {wedding && <YourFamily weddingId={wedding.id} eventName={eventName} />}
            </>
          ) : loading ? null : (
            <BrowseSections posts={posts} />
          )}
        </View>
      </Animated.ScrollView>

      <NavBar
        scroll={scroll}
        title={t('app.name')}
        back={false}
        trailing={
          <View style={styles.trailing}>
            <ChatButton />
            <ProfileButton />
          </View>
        }
      />
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  trailing: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  body: {
    gap: Spacing.xxl,
    paddingTop: Spacing.lg,
    paddingHorizontal: Sizes.pageGutter,
  },
  greeting: {
    gap: 2,
    marginBottom: -Spacing.md,
  },
  caps: {
    letterSpacing: 0.6,
  },
  block: {
    gap: Spacing.md,
  },
});
