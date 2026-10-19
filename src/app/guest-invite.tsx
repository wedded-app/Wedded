import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { FieldError } from '@/components/field-error';
import { StateView } from '@/components/state-view';
import { makeStyles, Spacing } from '@/constants/theme';
import { guestErrorKind, useGuestLists, useGuests, useInviteToEvent } from '@/data/guests';
import { answerLabel } from '@/features/guests/guest-helpers';
import { closeGuestSheet, PickSheet } from '@/features/guests/pick-sheet';
import { usePlanView } from '@/features/planner/use-plan-view';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { successHaptic } from '@/lib/haptics';

/**
 * Who's invited to one event (#308), /guest-invite?event={slug}: tick people,
 * or a whole list at once. Guests see only the events they're invited to on
 * their RSVP page. Someone already invited keeps their answer and stays
 * ticked here.
 */
export default function GuestInviteScreen() {
  const styles = useStyles();
  const { t } = useLocale();
  const { event: slug = '' } = useLocalSearchParams<{ event: string }>();
  const view = usePlanView();
  const weddingId = view.wedding?.id ?? null;
  const guests = useGuests(weddingId);
  const lists = useGuestLists(weddingId);
  const invite = useInviteToEvent();
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const event = view.chosen.find((e) => e.slug === slug);

  const everyone = guests.data ?? [];
  const items = everyone.map((guest) => {
    const invited = guest.invites.find((i) => i.eventSlug === slug);
    return {
      id: guest.id,
      name: guest.name,
      locked: !!invited,
      detail: invited
        ? t('guests.invite.already', { answer: answerLabel(invited.rsvp, invited.coming, t) })
        : guest.partySize > 1
          ? t('guests.people', { count: guest.partySize })
          : undefined,
    };
  });
  const invitedIds = new Set(items.filter((item) => item.locked).map((item) => item.id));
  const fresh = picked.filter((id) => !invitedIds.has(id));
  const tickAll = (ids: string[]) =>
    setPicked([...new Set([...picked, ...ids.filter((id) => !invitedIds.has(id))])]);

  const save = () => {
    if (!weddingId) return;
    setError(undefined);
    invite.mutate(
      { weddingId, eventSlug: slug, guestIds: fresh },
      {
        onSuccess: () => {
          successHaptic();
          closeGuestSheet();
        },
        onError: (e) => setError(t(`guests.errors.${guestErrorKind(e)}`)),
      },
    );
  };

  let empty;
  if (!view.wedding || view.isPending || guests.isPending) {
    empty = <StateView state="loading" />;
  } else if (!event) {
    empty = (
      <StateView state="empty" icon="calendar-outline" message={t('guests.invite.noEvent')} />
    );
  } else {
    empty = (
      <StateView
        state="empty"
        icon="people-outline"
        message={t('guests.invite.noGuests')}
        action={{ label: t('guests.byHand'), onPress: () => router.replace('/guest') }}
      />
    );
  }

  return (
    <PickSheet
      title={event ? t('guests.invite.title', { event: localized(event.name) }) : ''}
      intro={event ? t('guests.invite.intro') : undefined}
      items={event ? items : []}
      picked={picked}
      onChange={setPicked}
      empty={empty}
      footer={
        event && everyone.length > 0 ? (
          <>
            {error && <FieldError message={error} />}
            <Button
              icon="mail-outline"
              label={
                fresh.length > 0
                  ? t('guests.invite.send', { count: fresh.length })
                  : t('guests.invite.tick')
              }
              disabled={fresh.length === 0}
              loading={invite.isPending}
              onPress={save}
            />
          </>
        ) : null
      }
    >
      {event && everyone.length > 0 && (
        <View style={styles.lists}>
          <AppText variant="label" weight={600} color="text2" style={styles.pad}>
            {t('guests.invite.wholeList')}
          </AppText>
          <View style={styles.chips}>
            <Chip
              role="button"
              label={t('guests.invite.everyone')}
              onPress={() => tickAll(everyone.map((guest) => guest.id))}
            />
            {(lists.data ?? []).map((list) => (
              <Chip
                key={list.id}
                role="button"
                label={list.name}
                onPress={() => tickAll(list.guestIds)}
              />
            ))}
          </View>
        </View>
      )}
    </PickSheet>
  );
}

const useStyles = makeStyles(() => ({
  lists: {
    gap: Spacing.sm,
  },
  pad: {
    paddingHorizontal: Spacing.xs,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
}));
