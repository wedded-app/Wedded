import { router } from 'expo-router';
import { Alert, Platform } from 'react-native';

import type { GuestBand } from '@/data/inquiries';
import { useCities } from '@/data/places';
import { useHomeEvents } from '@/data/reference';
import { useVendorPhotos } from '@/data/vendor-media';
import { useSession } from '@/features/auth/session';
import { townNear } from '@/features/location/nearest-city';
import { useSearchLocation } from '@/features/location/search-location';
import { bandForCount, countForBand } from '@/features/onboarding/guest-count';
import { useDraftPlanView, usePlanView } from '@/features/planner/use-plan-view';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

import { useAskDraft } from './ask-draft';
import { writtenMessage } from './ask-message';
import { clampGuests } from './guest-picker';
import { GUEST_BANDS, planDatesFor, useInquiryVendor } from './inquiry-helpers';

/** The biggest guest band among the events, from their plan. */
function biggestBand(
  slugs: string[],
  guests: Record<string, string> | undefined,
): GuestBand | null {
  const bands = slugs
    .map((slug) => guests?.[slug])
    .filter(
      (band): band is GuestBand => GUEST_BANDS.includes(band as GuestBand) && band !== 'not_sure',
    );
  return bands.sort((a, b) => GUEST_BANDS.indexOf(b) - GUEST_BANDS.indexOf(a))[0] ?? null;
}

/**
 * Everything the pages of Ask for a quote share: the draft, the vendor and
 * its photo, and what the answers come to with the family's plan filled in:
 * the day, about how many guests, where, and the message Wed writes from it.
 */
export function useAsk() {
  const draft = useAskDraft();
  const { t } = useLocale();
  const vendor = useInquiryVendor(draft.vendorId);
  const photos = useVendorPhotos(draft.vendorId);
  const account = usePlanView();
  const phone = useDraftPlanView();
  // Their plan in their account, or the one kept on this phone before they had one
  const view =
    account.wedding || account.loading
      ? account
      : {
          ...account,
          plan: phone.plan,
          events: phone.events,
          chosen: phone.chosen,
          needsByEvent: phone.needsByEvent,
        };
  const home = useHomeEvents();
  const { profile } = useSession();
  const { place: searchPlace } = useSearchLocation();
  const cities = useCities();

  const v = vendor.data ?? null;
  const set = v?.questionSet ?? null;
  const name = v ? localized(v.name) : '';
  const homeEvents = (home.data ?? []).flatMap((section) =>
    section.events.map((event) => ({ ...event, phase: section.phase })),
  );
  // Their traditions' events, then any other the link named
  const allEvents = [
    ...view.events,
    ...homeEvents.filter((event) => !view.events.some((other) => other.slug === event.slug)),
  ];
  const weddingDaySlugs = allEvents
    .filter((event) => event.phase === 'wedding_day')
    .map((event) => event.slug);
  const planDates = planDatesFor(
    draft.eventSlugs,
    view.plan.eventDates,
    view.plan.weddingDate,
    weddingDaySlugs,
  );
  const date = draft.dateUnsure ? null : (draft.pickedDate ?? planDates.start);
  // With two or more events on their own days in the plan, each goes with the ask
  const eventDates =
    draft.dateUnsure || draft.pickedDate
      ? []
      : planDates.dates.flatMap(({ slug, date: day }) => {
          const event = allEvents.find((e) => e.slug === slug);
          return event ? [{ slug, event: localized(event.name), date: day }] : [];
        });
  const eventNames = draft.eventSlugs.flatMap((slug) => {
    const event = allEvents.find((e) => e.slug === slug);
    return event ? [localized(event.name)] : [];
  });
  const count = clampGuests(
    draft.guestCount ?? countForBand(biggestBand(draft.eventSlugs, view.plan.guests)),
  );
  const guestBand: GuestBand = draft.guestsUnsure ? 'not_sure' : bandForCount(count);
  // A hall is the place; anyone else needs to know where to come
  const place =
    set === 'venue'
      ? (v?.city ?? '')
      : (draft.place ?? townNear(searchPlace, cities.data ?? []) ?? profile?.city ?? '');
  const message =
    draft.ownMessage ??
    writtenMessage(t, draft, {
      events: eventNames,
      eventDates: eventDates.length >= 2 ? eventDates : [],
      date,
      guests: draft.guestsUnsure ? null : count,
      place: set === 'venue' ? null : place,
      set,
      alcoholPolicy: v?.hall.alcoholPolicy,
      counters: draft.liveCounters.map((c) => t(`inquiry.questions.stations.${c}`).toLowerCase()),
    });

  return {
    draft,
    vendor,
    v,
    set,
    name,
    heading: t(draft.tour ? 'ask.visitVendor' : 'ask.askVendor', { vendor: name }),
    photo: photos.data?.[0]?.url.small ?? null,
    view,
    allEvents,
    date,
    eventDates,
    count,
    guestBand,
    place,
    message,
    /** Close Ask, asking first when they've answered something. */
    leave: () => closeAsk(draft.touched, t),
  };
}

/** Leaving Ask: straight away when nothing was answered, else after asking. */
export function closeAsk(touched: boolean, t: (key: string) => string) {
  // A page opened straight from a link on the web has nowhere to go back to
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));
  if (!touched) {
    leave();
    return;
  }
  if (Platform.OS === 'web') {
    // Alert does nothing in a web browser, so the web uses the browser's own
    if (globalThis.confirm(`${t('inquiry.discardTitle')}\n\n${t('inquiry.discardBody')}`)) leave();
    return;
  }
  Alert.alert(t('inquiry.discardTitle'), t('inquiry.discardBody'), [
    { text: t('inquiry.keepEditing'), style: 'cancel' },
    { text: t('inquiry.discard'), style: 'destructive', onPress: leave },
  ]);
}
