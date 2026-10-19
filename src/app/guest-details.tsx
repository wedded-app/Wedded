import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { DateField } from '@/components/date-field';
import { Screen } from '@/components/screen';
import { SheetHeader } from '@/components/sheet-header';
import { StateView } from '@/components/state-view';
import { TextField } from '@/components/text-field';
import { makeStyles, Radius, Spacing } from '@/constants/theme';
import type { AccountWedding } from '@/data/wedding';
import type { TraditionEvent } from '@/data/reference';
import { closeGuestSheet } from '@/features/guests/pick-sheet';
import { usePlanView } from '@/features/planner/use-plan-view';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { successHaptic } from '@/lib/haptics';

type EventDetails = { date: string | null; time: string | null; place: string };

/**
 * What guests see on their RSVP page (#308), from the guest list: the
 * couple's names, and each event's day, start time and place.
 */
export default function GuestDetailsScreen() {
  const { t } = useLocale();
  const view = usePlanView();

  let content;
  if (!view.wedding || view.isPending) {
    content = <StateView state="loading" />;
  } else {
    content = <DetailsForm view={view} wedding={view.wedding} events={view.chosen} />;
  }
  return (
    <Screen edges={['top', 'bottom']}>
      <SheetHeader onClose={closeGuestSheet} title={t('guests.details.title')} />
      {content}
    </Screen>
  );
}

function DetailsForm({
  view,
  wedding,
  events,
}: {
  view: ReturnType<typeof usePlanView>;
  wedding: AccountWedding;
  events: TraditionEvent[];
}) {
  const styles = useStyles();
  const { t } = useLocale();
  const before = (slug: string): EventDetails => ({
    date: wedding.eventDates[slug] ?? null,
    time: wedding.eventTimes[slug] ?? null,
    place: wedding.eventPlaces[slug] ?? '',
  });
  const [names, setNames] = useState(wedding.title ?? '');
  const [details, setDetails] = useState(() =>
    Object.fromEntries(events.map((event) => [event.slug, before(event.slug)])),
  );
  const edit = (slug: string, change: Partial<EventDetails>) =>
    setDetails((current) => ({ ...current, [slug]: { ...current[slug], ...change } }));

  const save = () => {
    const title = names.trim().replace(/\s+/g, ' ') || null;
    if (title !== wedding.title) view.setTitle(title);
    for (const event of events) {
      const was = before(event.slug);
      const now = details[event.slug];
      const place = now.place.trim().replace(/\s+/g, ' ');
      if (now.date !== was.date) view.setEventDate(event.slug, now.date);
      if (now.time !== was.time) view.setEventTime(event.slug, now.time);
      if (place !== was.place) view.setEventPlace(event.slug, place || null);
    }
    successHaptic();
    closeGuestSheet();
  };

  return (
    <>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AppText color="text2" style={styles.pad}>
          {t('guests.details.intro')}
        </AppText>
        <TextField
          label={t('guests.details.names')}
          hint={t('guests.details.namesHint')}
          placeholder={t('guests.details.namesPlaceholder')}
          value={names}
          onChangeText={setNames}
          maxLength={80}
          // Autocorrect made "Kirat" "Kirsten" (not type="name": that offers the user's own name)
          autoCorrect={false}
        />
        {events.map((event) => {
          const name = localized(event.name);
          const mine = details[event.slug];
          return (
            <View key={event.slug} style={styles.event}>
              <AppText variant="heading" weight={700}>
                {name}
              </AppText>
              <DateField
                value={mine.date}
                onChange={(date) => edit(event.slug, { date })}
                placeholder={t('guests.details.date')}
              />
              <DateField
                mode="time"
                value={mine.time}
                onChange={(time) => edit(event.slug, { time })}
                placeholder={t('guests.details.time')}
              />
              <TextField
                label={t('guests.details.place', { event: name })}
                placeholder={t('guests.details.placePlaceholder')}
                value={mine.place}
                onChangeText={(place) => edit(event.slug, { place })}
                maxLength={200}
                multiline
              />
            </View>
          );
        })}
      </ScrollView>
      <View style={styles.footer}>
        <Button label={t('guests.details.save')} onPress={save} />
      </View>
    </>
  );
}

const useStyles = makeStyles((Colors) => ({
  content: {
    gap: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  pad: {
    paddingHorizontal: Spacing.xs,
  },
  event: {
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  footer: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
    backgroundColor: Colors.bg,
  },
}));
