import { useLocalSearchParams } from 'expo-router';
import Head from 'expo-router/head';
import { useState } from 'react';
import { Linking, Platform, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { eventIcon } from '@/components/event-icon';
import { FieldError } from '@/components/field-error';
import { Icon } from '@/components/icon';
import { NavScreen } from '@/components/nav';
import { StateView } from '@/components/state-view';
import { Stepper } from '@/components/stepper';
import { makeStyles, Radius, Spacing, useColors } from '@/constants/theme';
import { useRsvp, useRsvpPreview, type RsvpEvent } from '@/data/guests';
import { useEvent } from '@/data/reference';
import { guestErrorKind } from '@/features/guests/guest-helpers';
import { formatDate } from '@/features/inquiry/inquiry-helpers';
import { formatTime } from '@/features/vendors/profile-format';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { successHaptic } from '@/lib/haptics';

type Answer = { answer: 'yes' | 'no'; coming: number };

/** Their answer as saved, or null before they've answered. */
function savedAnswer(event: RsvpEvent, partySize: number): Answer | null {
  if (event.rsvp === 'pending') return null;
  return { answer: event.rsvp, coming: Math.min(event.coming ?? 0, partySize) };
}

/**
 * The RSVP page a guest opens from their invitation (#308), /rsvp/{token}.
 * No account and no app needed (many guests are elders, and it opens on the
 * web): the couple's names, each event they're invited to with its day,
 * time and place, and Yes or No with how many are coming. The same link
 * shows their answers and lets them change them later.
 */
export default function RsvpScreen() {
  const styles = useStyles();
  const Colors = useColors();
  const { t } = useLocale();
  const { token = '' } = useLocalSearchParams<{ token: string }>();
  const preview = useRsvpPreview(token);
  const rsvp = useRsvp();
  const [draft, setDraft] = useState<Record<string, Answer>>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>();

  let body;
  if (preview.isPending) {
    body = <StateView state="loading" />;
  } else if (preview.isError) {
    body = <StateView state="error" onRetry={() => void preview.refetch()} />;
  } else if (!preview.data) {
    body = (
      <View style={styles.card}>
        <Icon name="link-outline" size={32} color={Colors.text2} />
        <AppText variant="heading" weight={700}>
          {t('rsvp.notFound')}
        </AppText>
        <AppText color="text2">{t('rsvp.askFamily')}</AppText>
      </View>
    );
  } else {
    const { title, weddingDate, guestName, partySize, events } = preview.data;
    const answerFor = (event: RsvpEvent) => draft[event.eventSlug] ?? savedAnswer(event, partySize);
    const changed = events.filter((event) => {
      const mine = draft[event.eventSlug];
      const saved = savedAnswer(event, partySize);
      return mine && (mine.answer !== saved?.answer || mine.coming !== saved.coming);
    });
    const allAnswered = events.length > 0 && events.every((event) => event.rsvp !== 'pending');

    // One call per event they changed; the page then shows what was saved
    const send = async () => {
      setError(undefined);
      setSending(true);
      try {
        for (const event of changed) {
          const mine = draft[event.eventSlug];
          await rsvp.mutateAsync({
            token,
            eventSlug: event.eventSlug,
            answer: mine.answer,
            coming: mine.answer === 'yes' ? mine.coming : undefined,
          });
        }
        // Show what was saved before letting go of what they picked
        await preview.refetch();
        successHaptic();
        setDraft({});
        setSent(true);
      } catch (e) {
        setError(t(`guests.errors.${guestErrorKind(e)}`));
      } finally {
        setSending(false);
      }
    };

    body = (
      <>
        <View style={styles.card}>
          <AppText variant="bodyLg" color="text2">
            {t('rsvp.hello', { name: guestName })}
          </AppText>
          <AppText variant="title">{title ?? t('rsvp.aWedding')}</AppText>
          {weddingDate && <AppText variant="bodyLg">{formatDate(weddingDate)}</AppText>}
          {partySize > 1 && (
            <AppText color="text2">{t('rsvp.party', { count: partySize })}</AppText>
          )}
        </View>

        {events.length === 0 ? (
          <StateView state="empty" icon="calendar-outline" message={t('rsvp.noEvents')} />
        ) : (
          events.map((event) => (
            <EventAnswer
              key={event.eventSlug}
              event={event}
              answer={answerFor(event)}
              partySize={partySize}
              onChange={(answer) => {
                setSent(false);
                setDraft((current) => ({ ...current, [event.eventSlug]: answer }));
              }}
            />
          ))
        )}

        {changed.length > 0 ? (
          <View style={styles.send}>
            {error && <FieldError message={error} />}
            <Button
              icon="send-outline"
              label={t('rsvp.send')}
              loading={sending}
              onPress={() => void send()}
            />
          </View>
        ) : (
          (sent || allAnswered) && (
            <View style={styles.thanks} accessibilityLiveRegion="polite">
              <Icon name="checkmark-circle" size={28} color={Colors.success} />
              <AppText style={styles.grow}>{t('rsvp.saved')}</AppText>
            </View>
          )
        )}
      </>
    );
  }

  return (
    <NavScreen title={t('rsvp.title')}>
      <Head>
        <title>{t('rsvp.pageTitle')}</title>
        <meta name="description" content={t('rsvp.pageDescription')} />
      </Head>
      {body}
    </NavScreen>
  );
}

/** One event on the invitation: when and where, and their answer. */
function EventAnswer({
  event,
  answer,
  partySize,
  onChange,
}: {
  event: RsvpEvent;
  answer: Answer | null;
  partySize: number;
  onChange: (answer: Answer) => void;
}) {
  const styles = useStyles();
  const Colors = useColors();
  const { t } = useLocale();
  const details = useEvent(event.eventSlug);
  const name = details.data ? localized(details.data.name) : '';
  const when = [
    event.eventDate ? formatDate(event.eventDate) : null,
    // The database's time is "19:00:00"
    event.startTime ? formatTime(event.startTime.slice(0, 5)) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const directions = (place: string) => {
    const destination = encodeURIComponent(place);
    void Linking.openURL(
      Platform.OS === 'ios'
        ? `https://maps.apple.com/?daddr=${destination}`
        : `https://www.google.com/maps/dir/?api=1&destination=${destination}`,
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.icon}>
          <Icon name={eventIcon(event.eventSlug)} size={22} color={Colors.primary} />
        </View>
        <View style={styles.grow}>
          <AppText variant="heading" weight={700}>
            {name}
          </AppText>
          {when ? (
            <AppText weight={600} color="primary">
              {when}
            </AppText>
          ) : null}
        </View>
      </View>
      {event.place && (
        <View style={styles.block}>
          <AppText>{event.place}</AppText>
          <Button
            variant="secondary"
            icon="navigate-outline"
            label={t('rsvp.directions')}
            onPress={() => directions(event.place ?? '')}
          />
        </View>
      )}
      <View style={styles.block}>
        <AppText weight={600}>{t('rsvp.question')}</AppText>
        <View style={styles.chips} accessibilityRole="radiogroup">
          <Chip
            role="radio"
            label={t('rsvp.yes')}
            selected={answer?.answer === 'yes'}
            onPress={() =>
              onChange({
                answer: 'yes',
                coming: answer?.answer === 'yes' ? answer.coming : partySize,
              })
            }
          />
          <Chip
            role="radio"
            label={t('rsvp.no')}
            selected={answer?.answer === 'no'}
            onPress={() => onChange({ answer: 'no', coming: 0 })}
          />
        </View>
      </View>
      {answer?.answer === 'yes' && partySize > 1 && (
        <View style={styles.block}>
          <AppText weight={600}>{t('rsvp.howMany')}</AppText>
          <Stepper
            value={Math.max(1, answer.coming)}
            min={1}
            max={partySize}
            onChange={(coming) => onChange({ answer: 'yes', coming })}
            accessibilityLabel={t('rsvp.howMany')}
          />
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  card: {
    gap: Spacing.md,
    padding: Spacing.xl,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryTint,
  },
  grow: {
    flex: 1,
    gap: 2,
  },
  block: {
    gap: Spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  send: {
    gap: Spacing.sm,
  },
  thanks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.success,
  },
}));
