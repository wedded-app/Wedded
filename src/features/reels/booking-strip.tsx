import { useRouter } from 'expo-router';
import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { Alert, type LayoutChangeEvent, Platform, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Glass } from '@/components/glass';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { Spacing } from '@/constants/theme';
import { useVendorDateStatus } from '@/data/availability';
import { useConversations, useIsVendor, useStartConversation } from '@/data/chat';
import { useMyInquiries } from '@/data/inquiries';
import type { Reel } from '@/data/reels';
import { useSession } from '@/features/auth/session';
import { usePlanView } from '@/features/planner/use-plan-view';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';

import {
  freeLine,
  NO_FACTS,
  type StripFacts,
  type StripState,
  stripState,
  vendorStandings,
} from './strip-state';

// Over the video in light and dark mode alike, like the rest of a reel
// (reel-item's REEL_INK and REEL_DIM; not imported, as reel-item imports this)
const REEL_INK = '#FFFFFF';
const REEL_DIM = 'rgba(255,255,255,0.78)';
const TONES = {
  free: '#30D158',
  busy: '#FF6961',
  maybe: '#F2C27E',
} as const;
const ASKED = '#1F6B4A';
const ON_WHITE = '#000000';

const BookingFacts = createContext<StripFacts>(NO_FACTS);

/**
 * What every strip on a pager needs, read once for the whole pager: the
 * family's plan (events, dates, who they booked), the vendors they asked and
 * whether those wrote back, and the businesses this person runs.
 */
export function BookingFactsProvider({ children }: { children: ReactNode }) {
  const { plan, chosen, wedding } = usePlanView();
  const inquiries = useMyInquiries();
  const chats = useConversations();
  const { vendorIds } = useIsVendor();
  const facts = useMemo<StripFacts>(
    () => ({
      events: chosen.map((event) => ({ slug: event.slug, name: localized(event.name) })),
      eventDates: plan.eventDates ?? {},
      weddingDate: plan.weddingDate,
      bookedVendors: wedding?.bookedVendors ?? {},
      standings: vendorStandings(inquiries.data ?? [], chats.data ?? []),
      myVendorIds: vendorIds,
    }),
    [
      chosen,
      plan.eventDates,
      plan.weddingDate,
      wedding?.bookedVendors,
      inquiries.data,
      chats.data,
      vendorIds,
    ],
  );
  return <BookingFacts.Provider value={facts}>{children}</BookingFacts.Provider>;
}

/** What this reel's strip says, from the pager's facts. */
export function useStripState(reel: Reel): StripState {
  const facts = useContext(BookingFacts);
  return useMemo(() => stripState(reel, facts), [reel, facts]);
}

/**
 * The booking strip (the final look, 2026-10-23): a glass card along the
 * bottom of a reel, under the caption and over the tab bar, so every reel is
 * one tap from booking. A vendor's reel says "Book Dhol Di Awaaz · Free on
 * your Baraat · Ask" (whether they're free comes from the calendar they
 * keep; with none it says nothing about free); once asked, "Waiting for
 * their reply" until they write back; once booked, "You booked them · Chat".
 * A family's reel offers the vendors they tagged. The whole card is the
 * button. Ask itself asks a signed-out family to sign in when they send.
 */
export function BookingStrip({
  state,
  bottom,
  onHeight,
}: {
  state: Exclude<StripState, { kind: 'none' }>;
  /** From the bottom of the reel. */
  bottom: number;
  onHeight: (height: number) => void;
}) {
  const router = useRouter();
  const { t } = useLocale();
  const { requireSignIn } = useSession();
  const startChat = useStartConversation();
  const checking = state.kind === 'book' ? state : null;
  const status = useVendorDateStatus(checking?.vendor.id ?? null, checking?.date ?? null);

  // Alert does nothing in a web browser, so the web uses the browser's own
  const notify = (message: string) =>
    Platform.OS === 'web' ? globalThis.alert(message) : Alert.alert(message);
  const openChat = (vendorId: string) =>
    requireSignIn(() =>
      startChat.mutate(vendorId, {
        onSuccess: (id) => router.push({ pathname: '/chat/[id]', params: { id } }),
        onError: () => notify(t('chat.startFailed')),
      }),
    );

  let title: string;
  let line: string | null = null;
  let tone: keyof typeof TONES | null = null;
  let action: string;
  let hint: string;
  let asked = false;
  let onPress: () => void;
  switch (state.kind) {
    case 'book': {
      const event = state.event?.name ?? '';
      const free = freeLine(status.data, !!state.event);
      title = t('reels.strip.book', { name: state.vendor.name });
      line =
        free.key === 'askEvent'
          ? t('vendorTicket.ask', { event })
          : free.key === 'askAbout'
            ? t('reels.strip.askAbout')
            : t(`vendorTicket.${free.key}`, { event });
      tone = free.tone;
      action = t('reels.strip.ask');
      hint = t('reels.strip.askHint');
      onPress = () =>
        router.push({
          pathname: '/ask',
          params: state.askEvent
            ? { vendorId: state.vendor.id, event: state.askEvent }
            : { vendorId: state.vendor.id },
        });
      break;
    }
    case 'booked':
      title = t('reels.strip.booked', { name: state.vendor.name });
      line = state.event ? t('reels.strip.bookedFor', { event: state.event.name }) : null;
      tone = 'free';
      action = t('reels.strip.chat');
      hint = t('reels.strip.chatHint');
      onPress = () => openChat(state.vendor.id);
      break;
    case 'asked':
      title = t('reels.strip.asked', { name: state.vendor.name });
      line = state.replied ? t('reels.strip.wroteBack') : t('reels.strip.waiting');
      tone = state.replied ? 'free' : 'maybe';
      // Their reply comes to the chat the inquiry started
      action = state.replied ? t('reels.strip.chat') : t('reels.strip.askedButton');
      asked = !state.replied;
      hint = t('reels.strip.chatHint');
      onPress = () => openChat(state.vendor.id);
      break;
    case 'see': {
      const { vendors, eventSlug } = state;
      title = t('reels.strip.see');
      line = t('reels.strip.tagged', { count: vendors.length });
      action = t('reels.strip.seeThem');
      hint = t('reels.strip.seeHint');
      // One opens their page; several, a list to ask one of them from
      onPress = () =>
        vendors.length === 1
          ? router.push({ pathname: '/v/[slug]', params: { slug: vendors[0].slug } })
          : router.push({
              pathname: '/reel-book',
              params: {
                vendors: vendors.map((v) => v.slug).join(','),
                ...(eventSlug ? { event: eventSlug } : {}),
              },
            });
      break;
    }
  }

  return (
    <View
      style={[styles.wrap, { bottom }]}
      pointerEvents="box-none"
      onLayout={(event: LayoutChangeEvent) => onHeight(event.nativeEvent.layout.height)}
    >
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={[title, line, action].filter(Boolean).join('. ')}
        accessibilityHint={hint}
        pressedScale={0.98}
        onPress={() => {
          selectionHaptic();
          onPress();
        }}
      >
        {/* Dark glass, as the tab bar is over Reels. Never faded out: iOS
            drops the glass on a see-through view, so a hold hides it instead */}
        <Glass scheme="dark" interactive style={styles.card}>
          <View style={styles.words}>
            <AppText variant="body" weight={700} numberOfLines={1} style={styles.ink}>
              {title}
            </AppText>
            {line && (
              <View style={styles.lineRow}>
                {tone && <View style={[styles.dot, { backgroundColor: TONES[tone] }]} />}
                <AppText variant="label" numberOfLines={1} style={styles.dim}>
                  {line}
                </AppText>
              </View>
            )}
          </View>
          <View style={[styles.button, asked && styles.buttonAsked]}>
            {asked && <Icon name="checkmark" size={16} color={REEL_INK} weight="bold" />}
            <AppText
              variant="label"
              weight={700}
              numberOfLines={1}
              maxFontSizeMultiplier={1.3}
              style={asked ? styles.ink : styles.buttonText}
            >
              {action}
            </AppText>
          </View>
        </Glass>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 64,
    paddingVertical: Spacing.sm,
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.sm + 2,
    borderRadius: 26,
    borderCurve: 'continuous',
  },
  words: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  ink: {
    color: REEL_INK,
  },
  dim: {
    flexShrink: 1,
    color: REEL_DIM,
  },
  // The white pill, like the one behind For you and Following
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    paddingHorizontal: Spacing.lg,
    borderRadius: 999,
    backgroundColor: REEL_INK,
  },
  buttonAsked: {
    backgroundColor: ASKED,
  },
  buttonText: {
    color: ON_WHITE,
  },
});
