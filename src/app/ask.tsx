import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { AccessibilityInfo, Alert, Platform, ScrollView, type TextInput, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Checkbox } from '@/components/checkbox';
import { Chip } from '@/components/chip';
import { FieldError } from '@/components/field-error';
import { Screen } from '@/components/screen';
import { SheetHeader } from '@/components/sheet-header';
import { StateView } from '@/components/state-view';
import { TextField } from '@/components/text-field';
import { makeStyles, Spacing } from '@/constants/theme';
import { useSendInquiry, type GuestBand, type ReplyBy, type SendOutcome } from '@/data/inquiries';
import { useVendorDateStatus } from '@/data/availability';
import { useHomeEvents } from '@/data/reference';
import { usePlan } from '@/features/planner/plan';
import { normalizePhone } from '@/features/auth/about-you-validation';
import { useSession } from '@/features/auth/session';
import { CatererQuestions, VenueQuestions } from '@/features/inquiry/category-questions';
import {
  catererDetails,
  emptyCatererAnswers,
  emptyVenueAnswers,
  questionSetFor,
  venueDetails,
  type CatererAnswers,
  type VenueAnswers,
} from '@/features/inquiry/details';
import {
  eventChips,
  formatDate,
  fromDateString,
  GUEST_BANDS,
  planDatesFor,
  suggestedMessage,
  toDateString,
  useInquiryVendor,
} from '@/features/inquiry/inquiry-helpers';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { formatPhone } from '@/lib/phone';

const REPLY_BY: ReplyBy[] = ['call', 'text', 'whatsapp', 'email'];

/**
 * "Ask about price & date" (vision S11), a modal. `?vendorId=` is required;
 * `&event=` preselects the event they came from; `&kind=tour` on a venue asks
 * for a visit ("Book a tour") with up to three preferred times. Anyone can fill it in; Send
 * asks logged-out people to sign in, then sends the same draft.
 */
export default function AskScreen() {
  const styles = useStyles();
  const { t, locale } = useLocale();
  const params = useLocalSearchParams<{ vendorId?: string; event?: string; kind?: string }>();
  const isTour = params.kind === 'tour';
  const vendorId = params.vendorId ?? '';
  const vendor = useInquiryVendor(vendorId);
  const events = useHomeEvents();
  const { profile, requireSignIn } = useSession();
  const sending = useSendInquiry();

  const [eventSlugs, setEventSlugs] = useState<string[]>(params.event ? [params.event] : []);
  // Chips for the event they came from and the vendor's events show first;
  // the rest wait behind "Other events". Fixed at open, so chips don't jump.
  const [firstEvents] = useState<string[]>(params.event ? [params.event] : []);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const plan = usePlan();
  // The date they picked themselves; until then it follows My Wedding
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  // The family's wedding-day events (Anand Karaj, Reception…), from the data
  const weddingDaySlugs = (events.data ?? [])
    .filter((section) => section.phase === 'wedding_day')
    .flatMap((section) => section.events.map((e) => e.slug));
  const planDates = planDatesFor(eventSlugs, plan.eventDates, plan.weddingDate, weddingDaySlugs);
  const date = pickedDate ?? planDates.start;
  const [dateUnsure, setDateUnsure] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const dateStatus = useVendorDateStatus(vendorId || null, dateUnsure ? null : date);
  // The guest count set for this event in My Wedding, if there is one
  const plannedGuests = plan.guests?.[params.event ?? ''];
  const [guests, setGuests] = useState<GuestBand | null>(
    GUEST_BANDS.includes(plannedGuests as GuestBand) ? (plannedGuests as GuestBand) : null,
  );
  const [place, setPlace] = useState(profile?.city ?? '');
  const [ownMessage, setOwnMessage] = useState<string | null>(null);
  const [name, setName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile ? formatPhone(profile.phone) : '');
  const [replyBy, setReplyBy] = useState<ReplyBy>('text');
  const [error, setError] = useState<string>();
  // A required answer that's missing or wrong, shown at its own field
  const [fieldError, setFieldError] = useState<{ field: Field; message: string } | null>(null);
  const scroll = useRef<ScrollView>(null);
  // Where each field sits in the scroll, to bring a missing one into view
  const fieldY = useRef<Partial<Record<Field, number>>>({});
  const placeInput = useRef<TextInput>(null);
  const messageInput = useRef<TextInput>(null);
  const phoneInput = useRef<TextInput>(null);
  const [duplicateAt, setDuplicateAt] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [venueAnswers, setVenueAnswers] = useState<VenueAnswers>(emptyVenueAnswers);
  const [catererAnswers, setCatererAnswers] = useState<CatererAnswers>(emptyCatererAnswers);
  const questionSet = questionSetFor(vendor.data?.categorySlug ?? null);

  const allEvents = events.data?.flatMap((section) => section.events) ?? [];
  // Each chosen event's own day from My Wedding, by name, for the message and the note
  const namedPlanDates = dateUnsure
    ? []
    : planDates.dates.flatMap(({ slug, date: day }) => {
        const event = allEvents.find((e) => e.slug === slug);
        return event ? [{ slug, event: event.name, date: day }] : [];
      });
  const chosenEvents = allEvents.filter((event) => eventSlugs.includes(event.slug));
  const eventChoices = eventChips(
    allEvents,
    firstEvents,
    vendor.data?.eventSlugs ?? [],
    showAllEvents,
  );
  const suggested = suggestedMessage(t, locale, {
    events: chosenEvents.map((event) => event.name),
    date: dateUnsure ? null : date,
    place,
    guests,
    tour: isTour && questionSet === 'venue',
    eventDates: namedPlanDates,
  });
  const message = ownMessage ?? suggested;

  const change =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setTouched(true);
      setError(undefined);
      setFieldError(null);
    };

  const remember = (field: Field, event: { nativeEvent: { layout: { y: number } } }) => {
    fieldY.current[field] = event.nativeEvent.layout.y;
  };

  // Shows what's missing at its field, scrolls to it, puts the cursor there
  // and reads it out, so Send never looks like it did nothing
  function showMissing(field: Field, message: string) {
    setError(undefined);
    setFieldError({ field, message });
    const y = fieldY.current[field];
    if (y !== undefined)
      scroll.current?.scrollTo({ y: Math.max(0, y - Spacing.lg), animated: true });
    const input =
      field === 'place'
        ? placeInput
        : field === 'message'
          ? messageInput
          : field === 'phone'
            ? phoneInput
            : null;
    input?.current?.focus();
    AccessibilityInfo.announceForAccessibility(message);
  }

  function close() {
    // A page opened straight from a link on the web has nowhere to go back to
    const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));
    if (!touched) {
      leave();
      return;
    }
    if (Platform.OS === 'web') {
      // Alert does nothing in a web browser, so the web uses the browser's own
      if (globalThis.confirm(`${t('inquiry.discardTitle')}\n\n${t('inquiry.discardBody')}`))
        leave();
      return;
    }
    Alert.alert(t('inquiry.discardTitle'), t('inquiry.discardBody'), [
      { text: t('inquiry.keepEditing'), style: 'cancel' },
      { text: t('inquiry.discard'), style: 'destructive', onPress: leave },
    ]);
  }

  function handle(outcome: SendOutcome, sentAgain: boolean) {
    switch (outcome.kind) {
      case 'sent':
      case 'queued':
        router.replace({
          pathname: '/ask-sent',
          params: {
            vendorId,
            event: eventSlugs[0] ?? '',
            queued: outcome.kind === 'queued' ? '1' : '',
          },
        });
        return;
      case 'duplicate':
        setDuplicateAt(outcome.previousAt);
        return;
      case 'needsProfile':
        requireSignIn(() => send(sentAgain));
        return;
      case 'rateLimited':
        setError(
          t(outcome.limit === 'day' ? 'inquiry.errors.tooManyDay' : 'inquiry.errors.tooManyHour'),
        );
        return;
      case 'vendorNotFound':
        setError(t('inquiry.errors.vendorGone'));
        return;
      case 'invalid':
        setError(t('inquiry.errors.invalid'));
        return;
      case 'offline':
        setError(t('inquiry.errors.offline'));
        return;
      default:
        setError(t('inquiry.errors.failed'));
    }
  }

  function send(sendAgain = false) {
    if (!guests) {
      showMissing('guests', t('inquiry.errors.guests'));
      return;
    }
    if (!place.trim()) {
      showMissing('place', t('inquiry.errors.place'));
      return;
    }
    if (!message.trim()) {
      showMissing('message', t('inquiry.errors.message'));
      return;
    }
    const cleanPhone = phone.trim() ? normalizePhone(phone) : null;
    if (phone.trim() && !cleanPhone) {
      showMissing('phone', t('aboutYou.errors.phoneInvalid'));
      return;
    }
    setError(undefined);
    setFieldError(null);
    setDuplicateAt(null);
    const draft = {
      vendorId,
      eventSlugs,
      eventDate: dateUnsure ? null : date,
      guestBand: guests,
      location: place.trim(),
      message: message.trim(),
      preferredContact: replyBy,
      language: locale,
      name: name.trim() || undefined,
      phone: cleanPhone ?? undefined,
      details: {
        ...(questionSet === 'venue'
          ? venueDetails(venueAnswers, isTour)
          : questionSet === 'caterer'
            ? catererDetails(catererAnswers)
            : {}),
        // Each event's own day from My Wedding, so the vendor sees them all
        ...(namedPlanDates.length > 0
          ? { eventDates: Object.fromEntries(namedPlanDates.map((d) => [d.slug, d.date])) }
          : {}),
      },
      sendAgain,
    };
    requireSignIn(() =>
      sending.mutate(draft, { onSuccess: (outcome) => handle(outcome, sendAgain) }),
    );
  }

  // Until the vendor loads there's no form, but there's always a way out.
  let notReady;
  if (!vendorId || vendor.isError || events.isError) {
    notReady = <StateView state="error" onRetry={() => void vendor.refetch()} />;
  } else if (vendor.isPending || events.isPending) {
    notReady = <StateView state="loading" />;
  } else if (!vendor.data) {
    notReady = (
      <StateView state="empty" icon="storefront-outline" message={t('inquiry.errors.vendorGone')} />
    );
  }
  if (notReady || !vendor.data) {
    return (
      <Screen edges={['top', 'bottom']}>
        <SheetHeader onClose={close} />
        {notReady}
      </Screen>
    );
  }
  const vendorName = localized(vendor.data.name, locale);

  return (
    <Screen edges={['top', 'bottom']}>
      <SheetHeader
        onClose={close}
        title={t(isTour && questionSet === 'venue' ? 'inquiry.tourTitle' : 'inquiry.title')}
      />

      <ScrollView
        ref={scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Card style={styles.vendor}>
          <AppText variant="bodyLg" weight={700}>
            {vendorName}
          </AppText>
          <AppText color="text2">
            {[vendor.data.category && localized(vendor.data.category, locale), vendor.data.city]
              .filter(Boolean)
              .join(' · ')}
          </AppText>
        </Card>

        <Section title={t('inquiry.whichEvent')}>
          <View style={styles.chips}>
            {eventChoices.shown.map((event) => (
              <Chip
                key={event.slug}
                label={localized(event.name, locale)}
                selected={eventSlugs.includes(event.slug)}
                onPress={() =>
                  change(setEventSlugs)(
                    eventSlugs.includes(event.slug)
                      ? eventSlugs.filter((slug) => slug !== event.slug)
                      : [...eventSlugs, event.slug],
                  )
                }
              />
            ))}
            <Chip
              label={t('saved.notSure')}
              selected={eventSlugs.length === 0}
              onPress={() => change(setEventSlugs)([])}
            />
          </View>
          {eventChoices.hasMore && (
            <Button
              variant="text"
              icon="chevron-down"
              label={t('inquiry.otherEvents')}
              onPress={() => setShowAllEvents(true)}
            />
          )}
        </Section>

        <Section title={t('inquiry.date')}>
          {!dateUnsure && (
            <Button
              variant="secondary"
              icon="calendar-outline"
              label={date ? formatDate(date) : t('inquiry.pickDate')}
              onPress={() => setPickerOpen(true)}
            />
          )}
          {pickerOpen && !dateUnsure && (
            <DateTimePicker
              value={date ? fromDateString(date) : new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              minimumDate={new Date()}
              onChange={(event, picked) => {
                if (Platform.OS !== 'ios') setPickerOpen(false);
                if (event.type === 'set' && picked) change(setPickedDate)(toDateString(picked));
              }}
            />
          )}
          {pickerOpen && Platform.OS === 'ios' && !dateUnsure && (
            <Button
              variant="text"
              label={t('location.done')}
              onPress={() => setPickerOpen(false)}
            />
          )}
          {namedPlanDates.length >= 2 && (
            <AppText color="text2">
              {t('inquiry.fromPlan', {
                dates: namedPlanDates
                  .map((d) => `${localized(d.event, locale)}: ${formatDate(d.date)}`)
                  .join(' · '),
              })}
            </AppText>
          )}
          {namedPlanDates.length === 1 && !pickedDate && (
            <AppText color="text2">
              {t('inquiry.fromPlanOne', {
                event: localized(namedPlanDates[0].event, locale),
                date: formatDate(namedPlanDates[0].date),
              })}
            </AppText>
          )}
          {!dateUnsure && date && dateStatus.data && dateStatus.data !== 'unknown' && (
            <AppText
              color={
                dateStatus.data === 'open'
                  ? 'success'
                  : dateStatus.data === 'booked'
                    ? 'error'
                    : 'text2'
              }
              weight={600}
            >
              {t(`inquiry.dateStatus.${dateStatus.data}`)}
            </AppText>
          )}
          <Checkbox
            label={t('inquiry.dateUnsure')}
            checked={dateUnsure}
            onChange={(checked) => {
              change(setDateUnsure)(checked);
              if (checked) setPickerOpen(false);
            }}
          />
        </Section>

        <View onLayout={(event) => remember('guests', event)}>
          <Section title={t('inquiry.guests')}>
            <View style={styles.chips} accessibilityRole="radiogroup">
              {GUEST_BANDS.map((band) => (
                <Chip
                  key={band}
                  role="radio"
                  label={t(`inquiry.guestBands.${band}`)}
                  selected={guests === band}
                  onPress={() => change(setGuests)(band)}
                />
              ))}
            </View>
            {fieldError?.field === 'guests' && <FieldError message={fieldError.message} />}
          </Section>
        </View>

        <View onLayout={(event) => remember('place', event)}>
          <TextField
            ref={placeInput}
            type="city"
            label={t('inquiry.where')}
            hint={t('inquiry.whereHint')}
            value={place}
            onChangeText={change(setPlace)}
            maxLength={120}
            error={fieldError?.field === 'place' ? fieldError.message : undefined}
          />
        </View>

        {questionSet === 'venue' && (
          <VenueQuestions
            answers={venueAnswers}
            onChange={change(setVenueAnswers)}
            isTour={isTour}
          />
        )}
        {questionSet === 'caterer' && (
          <CatererQuestions answers={catererAnswers} onChange={change(setCatererAnswers)} />
        )}

        <View style={styles.section} onLayout={(event) => remember('message', event)}>
          <TextField
            ref={messageInput}
            label={t('inquiry.message')}
            error={fieldError?.field === 'message' ? fieldError.message : undefined}
            value={message}
            onChangeText={change(setOwnMessage)}
            multiline
            maxLength={2000}
          />
          {ownMessage !== null && (
            <Button
              variant="text"
              label={t('inquiry.useSuggested')}
              onPress={() => setOwnMessage(null)}
            />
          )}
        </View>

        {profile ? (
          <>
            <TextField
              type="name"
              label={t('aboutYou.name')}
              value={name}
              onChangeText={change(setName)}
            />
            <View onLayout={(event) => remember('phone', event)}>
              <TextField
                ref={phoneInput}
                type="phone"
                label={t('aboutYou.phone')}
                value={phone}
                onChangeText={change(setPhone)}
                error={fieldError?.field === 'phone' ? fieldError.message : undefined}
              />
            </View>
          </>
        ) : (
          <AppText color="text2">{t('inquiry.signInAtSend')}</AppText>
        )}

        <Section title={t('inquiry.replyBy')}>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {REPLY_BY.map((way) => (
              <Chip
                key={way}
                role="radio"
                label={t(`inquiry.replyWays.${way}`)}
                selected={replyBy === way}
                onPress={() => change(setReplyBy)(way)}
              />
            ))}
          </View>
        </Section>

        <AppText color="text2">{t('inquiry.consent', { vendor: vendorName })}</AppText>

        {duplicateAt && (
          <Card style={styles.section}>
            <AppText weight={700}>
              {t('inquiry.alreadyAsked', {
                vendor: vendorName,
                date: formatDate(duplicateAt.slice(0, 10)),
              })}
            </AppText>
            <Button
              label={t('inquiry.sendAgain')}
              onPress={() => send(true)}
              loading={sending.isPending}
            />
          </Card>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {/* Sending went wrong: said right above Send, never off screen */}
        {error && <FieldError message={error} />}
        <Button
          label={t('inquiry.send')}
          icon="send-outline"
          loading={sending.isPending}
          onPress={() => send(false)}
        />
      </View>
    </Screen>
  );
}

type Field = 'guests' | 'place' | 'message' | 'phone';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <AppText variant="heading" accessibilityRole="header">
        {title}
      </AppText>
      {children}
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  grow: {
    flex: 1,
  },
  content: {
    gap: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  vendor: {
    gap: Spacing.xs,
  },
  section: {
    gap: Spacing.md,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  footer: {
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
}));
