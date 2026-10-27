import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { FieldError } from '@/components/field-error';
import { StateView } from '@/components/state-view';
import { makeStyles, Spacing } from '@/constants/theme';
import {
  guestErrorKind,
  useGuestLists,
  useGuests,
  useInviteToEvent,
  useUninviteFromEvent,
} from '@/data/guests';
import {
  answerLabel,
  inviteChanges,
  retick,
  tickedIds,
  type InviteTicks,
} from '@/features/guests/guest-helpers';
import { closeGuestSheet, confirm, PickSheet } from '@/features/guests/pick-sheet';
import { usePlanView } from '@/features/planner/use-plan-view';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { successHaptic } from '@/lib/haptics';

/**
 * Who's invited to one event (#308), /guest-invite?event={slug}: tick people,
 * or a whole list at once. Guests see only the events they're invited to on
 * their RSVP page. Someone already invited starts ticked; unticking them takes
 * them off the event (#319), with their answer for it, so that asks first.
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
  const uninvite = useUninviteFromEvent();
  // Only the couple's own changes, so others' changes while it's open stay
  const [ticks, setTicks] = useState<InviteTicks>(() => new Map());
  const [error, setError] = useState<string>();
  const event = view.chosen.find((e) => e.slug === slug);

  const everyone = guests.data ?? [];
  const invites = new Map(
    everyone.flatMap((guest) => {
      const invited = guest.invites.find((i) => i.eventSlug === slug);
      return invited ? [[guest.id, invited] as const] : [];
    }),
  );
  const items = everyone.map((guest) => {
    const invited = invites.get(guest.id);
    return {
      id: guest.id,
      name: guest.name,
      detail: invited
        ? t('guests.invite.already', { answer: answerLabel(invited.rsvp, invited.coming, t) })
        : guest.partySize > 1
          ? t('guests.people', { count: guest.partySize })
          : undefined,
    };
  });
  const invitedIds = new Set(invites.keys());
  const ticked = tickedIds(
    everyone.map((guest) => guest.id),
    invitedIds,
    ticks,
  );
  const { fresh, removed } = inviteChanges(ticks, invitedIds);
  const choose = (next: string[]) => setTicks(retick(ticks, ticked, next));
  const tickAll = (ids: string[]) => choose([...new Set([...ticked, ...ids])]);

  const save = async () => {
    if (!weddingId) return;
    setError(undefined);
    try {
      if (fresh.length > 0) {
        await invite.mutateAsync({ weddingId, eventSlug: slug, guestIds: fresh });
      }
      if (removed.length > 0) {
        await uninvite.mutateAsync({ weddingId, eventSlug: slug, guestIds: removed });
      }
      successHaptic();
      closeGuestSheet();
    } catch (e) {
      setError(t(`guests.errors.${guestErrorKind(e)}`));
    }
  };

  const onSave = () => {
    const answered = removed.filter((id) => invites.get(id)?.rsvp !== 'pending');
    if (answered.length === 0 || !event) {
      void save();
      return;
    }
    const name = everyone.find((guest) => guest.id === answered[0])?.name ?? '';
    const eventName = localized(event.name);
    confirm(
      t('guests.invite.removeTitle', { event: eventName }),
      t('guests.invite.removeBody', { count: answered.length, name, event: eventName }),
      t('guests.invite.removeYes'),
      t('guests.invite.removeNo'),
      () => void save(),
    );
  };

  let label = t('guests.invite.tick');
  if (fresh.length > 0 && removed.length > 0) label = t('guests.invite.saveBoth');
  else if (fresh.length > 0) label = t('guests.invite.send', { count: fresh.length });
  else if (removed.length > 0) label = t('guests.invite.remove', { count: removed.length });

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
      picked={ticked}
      onChange={choose}
      empty={empty}
      footer={
        event && everyone.length > 0 ? (
          <>
            {error && <FieldError message={error} />}
            <Button
              icon={
                fresh.length === 0 && removed.length > 0 ? 'person-remove-outline' : 'mail-outline'
              }
              label={label}
              disabled={fresh.length === 0 && removed.length === 0}
              loading={invite.isPending || uninvite.isPending}
              onPress={onSave}
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
