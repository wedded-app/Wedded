import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/button';
import { FieldError } from '@/components/field-error';
import { StateView } from '@/components/state-view';
import { TextField } from '@/components/text-field';
import {
  guestErrorKind,
  useDeleteGuestList,
  useGuestLists,
  useGuests,
  useSaveGuestList,
  type Guest,
  type GuestList,
} from '@/data/guests';
import { useWeddingPlan } from '@/data/wedding';
import { guestTotals } from '@/features/guests/guest-helpers';
import { closeGuestSheet, PickSheet } from '@/features/guests/pick-sheet';
import { useLocale } from '@/i18n/locale-context';
import { successHaptic } from '@/lib/haptics';
import { formatPhone } from '@/lib/phone';
import { confirm } from '@/lib/confirm';

/**
 * A named guest list ("Mehndi list", "Mom's side", #308): its name and who's
 * on it, ticked from the guest list. A whole list can then be invited to an
 * event. /guest-list starts one; /guest-list?id= changes or deletes it.
 */
export default function GuestListScreen() {
  const { t } = useLocale();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { wedding } = useWeddingPlan();
  const guests = useGuests(wedding?.id ?? null);
  const lists = useGuestLists(wedding?.id ?? null);
  const list = lists.data?.find((l) => l.id === id);

  if (!wedding || guests.isPending || lists.isPending || (id && !list)) {
    const waiting = !wedding || guests.isPending || lists.isPending;
    return (
      <PickSheet
        title={t('guests.list.newTitle')}
        items={[]}
        picked={[]}
        onChange={() => {}}
        empty={
          waiting ? (
            <StateView state="loading" />
          ) : (
            <StateView state="empty" icon="list-outline" message={t('guests.list.gone')} />
          )
        }
        footer={null}
      />
    );
  }
  return (
    <ListSheet
      key={list?.id ?? 'new'}
      weddingId={wedding.id}
      list={list}
      guests={guests.data ?? []}
    />
  );
}

function ListSheet({
  weddingId,
  list,
  guests,
}: {
  weddingId: string;
  list?: GuestList;
  guests: Guest[];
}) {
  const { t } = useLocale();
  const save = useSaveGuestList();
  const remove = useDeleteGuestList();
  const [name, setName] = useState(list?.name ?? '');
  const [picked, setPicked] = useState(list?.guestIds ?? []);
  const [nameError, setNameError] = useState<string>();
  const [error, setError] = useState<string>();
  const failed = (e: unknown) => setError(t(`guests.errors.${guestErrorKind(e)}`));

  const onSave = () => {
    const clean = name.trim().replace(/\s+/g, ' ');
    setNameError(clean ? undefined : t('guests.list.nameRequired'));
    if (!clean) return;
    setError(undefined);
    save.mutate(
      { weddingId, id: list?.id, name: clean, guestIds: picked },
      {
        onSuccess: () => {
          successHaptic();
          closeGuestSheet();
        },
        onError: failed,
      },
    );
  };

  const askDelete = (doomed: GuestList) =>
    confirm(
      t('guests.list.deleteTitle', { name: doomed.name }),
      t('guests.list.deleteBody'),
      t('guests.list.delete'),
      t('guests.list.keep'),
      () =>
        remove.mutate(
          { weddingId, id: doomed.id },
          { onSuccess: closeGuestSheet, onError: failed },
        ),
    );

  return (
    <PickSheet
      title={list ? list.name : t('guests.list.newTitle')}
      intro={t('guests.list.intro')}
      items={guests.map((guest) => ({
        id: guest.id,
        name: guest.name,
        detail: guest.phone ? formatPhone(guest.phone) : (guest.email ?? undefined),
      }))}
      picked={picked}
      onChange={setPicked}
      empty={<StateView state="empty" icon="people-outline" message={t('guests.list.noGuests')} />}
      footer={
        <>
          {error && <FieldError message={error} />}
          <Button
            label={t('guests.list.save', {
              count: guestTotals(guests.filter((guest) => picked.includes(guest.id))).people,
            })}
            loading={save.isPending}
            onPress={onSave}
          />
        </>
      }
    >
      <TextField
        label={t('guests.list.name')}
        placeholder={t('guests.list.namePlaceholder')}
        value={name}
        onChangeText={setName}
        maxLength={60}
        error={nameError}
      />
      {list && (
        <Button
          variant="text"
          labelColor="error"
          label={t('guests.list.delete')}
          loading={remove.isPending}
          onPress={() => askDelete(list)}
        />
      )}
    </PickSheet>
  );
}
