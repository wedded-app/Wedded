import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { NavBar, useNavScroll, useNavTop } from '@/components/nav';
import { useBottomSpace } from '@/components/tab-bar';
import { Sizes, Spacing, useColors } from '@/constants/theme';
import { useIsVendor } from '@/data/chat';
import { useSession } from '@/features/auth/session';
import { ChatButton } from '@/features/chat/chat-button';
import { DateCard } from '@/features/home/date-card';
import { EventsTimeline } from '@/features/home/events-timeline';
import { greetingKey, todayLine } from '@/features/home/greeting';
import { HallShelf } from '@/features/home/hall-shelf';
import { NextUp } from '@/features/home/next-up';
import { PlanByEvent } from '@/features/home/plan-by-event';
import { ReelsRow } from '@/features/home/reels-row';
import { SavePlanCard } from '@/features/home/save-plan-card';
import { VendorPhotoCards } from '@/features/home/vendor-photo-cards';
import { hasDraftPlan, useWeddingDraft } from '@/features/home/wedding-draft';
import { YourFamily } from '@/features/home/your-family';
import { useKeepDraftOnSignIn } from '@/features/onboarding/save-draft';
import { YouButton } from '@/features/settings/settings-button';
import { findForPlan } from '@/features/planner/find-for-plan';
import { useDraftPlanView, usePlanView } from '@/features/planner/use-plan-view';
import { WebsiteCard } from '@/features/website/website-card';
import { WedLine } from '@/features/wed/wed-line';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

/**
 * S4 Home answers one question: what should we do next? (the final look,
 * 2026-10-23; canvas board "2 · Home"). Its parts, always in this order:
 * today's date and a greeting, with Messages at the top left and you at the
 * top right (Sign in, or your initial, which opens Settings; 2026-11-11); the wedding card (OmbreBackground; with a plan it counts down
 * and opens My Wedding, before one it asks when the wedding is); Wed's line,
 * only when Wed needs an OK; Up next, one ticket at a time; your events,
 * each saying in words what it still needs; vendors free on your dates; the
 * website; and what the family has been up to. No booked counts. Before
 * there's a plan (Fezy, 2026-11-11: make them want to start one and tap
 * around): Plan by event, a tradition's events down a rail with photos,
 * ending at "Your dates go here"; then one shelf of halls and a row of
 * wedding reels. A plan made before signing in shows its own events instead,
 * from this phone, with a card to save it; signing in saves it
 * (useKeepDraftOnSignIn).
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
  const [refreshing, setRefreshing] = useState(false);
  const { wedding, loading, plan, events, next } = view;
  const planning = !!wedding || (loading && !!plan.syncedWeddingId);
  // A vendor account that isn't planning a wedding gets no "Plan your wedding"
  // cover (their My business card comes first instead), and nor does someone
  // who joined just looking: they came to browse, not to be asked to plan
  const { isVendor } = useIsVendor();
  const { profile, status } = useSession();
  const browsing = !isVendor && profile?.joined_as !== 'looking';
  // The wedding card: the plan's countdown, or before a plan, starting one
  const showDateCard = !planning && !loading && browsing;
  // A plan made in the first questions before signing in, kept on this phone
  const draft = useWeddingDraft();
  const phoneView = useDraftPlanView();
  const drafted = !planning && hasDraftPlan(draft);
  useKeepDraftOnSignIn();

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
              <EventsTimeline view={view} scrollY={scroll.scrollY} />
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
            <>
              {drafted ? (
                <>
                  <EventsTimeline
                    view={phoneView}
                    scrollY={scroll.scrollY}
                    onOpen={(slug) => router.push({ pathname: '/e/[slug]', params: { slug } })}
                  />
                  {status !== 'signedIn' && <SavePlanCard />}
                </>
              ) : (
                <PlanByEvent scrollY={scroll.scrollY} />
              )}
              <HallShelf
                events={(drafted ? phoneView.chosen : events.filter((event) => event.isCore)).map(
                  (event) => event.slug,
                )}
                needsByEvent={drafted ? phoneView.needsByEvent : view.needsByEvent}
                date={draft.date}
                guestBand={draft.guestBand}
              />
              <ReelsRow />
            </>
          )}
        </View>
      </Animated.ScrollView>

      <NavBar
        scroll={scroll}
        title={t('app.name')}
        back={false}
        leading={<ChatButton plain />}
        trailing={<YouButton />}
      />
    </View>
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
  greeting: {
    gap: 2,
    marginBottom: -Spacing.md,
  },
  caps: {
    letterSpacing: 0.6,
  },
});
