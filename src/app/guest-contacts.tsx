import { Contact, ContactField, ContactsSortOrder, requestPermissionsAsync } from 'expo-contacts';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Platform, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { FieldError } from '@/components/field-error';
import { StateView } from '@/components/state-view';
import { makeStyles, Radius, Spacing } from '@/constants/theme';
import { useAddGuests, useGuests, type NewGuest } from '@/data/guests';
import { useWeddingPlan } from '@/data/wedding';
import { contactToGuest, guestErrorKind } from '@/features/guests/guest-helpers';
import { closeGuestSheet, PickSheet } from '@/features/guests/pick-sheet';
import { useLocale } from '@/i18n/locale-context';
import { successHaptic } from '@/lib/haptics';
import { formatPhone } from '@/lib/phone';

type Access = 'asking' | 'denied' | 'all' | 'limited' | 'failed';
type PhoneGuest = NewGuest & { id: string };

/** The phone's contacts as guests to tick (only the name, numbers and emails are read). */
async function readContacts(): Promise<PhoneGuest[]> {
  const contacts = await Contact.getAllDetails(
    [ContactField.FULL_NAME, ContactField.PHONES, ContactField.EMAILS],
    { sortOrder: ContactsSortOrder.UserDefault },
  );
  return contacts.flatMap((contact) => {
    const guest = contactToGuest(contact);
    return guest ? [{ ...guest, id: contact.id }] : [];
  });
}

/**
 * Add guests from the phone's contacts (#308). Contacts permission is asked
 * for only now, after they tapped Add from contacts. The whole address book
 * is read on the phone to show it, but only the people they tick are saved,
 * and only their name, phone and email. iOS can share just some contacts;
 * then there's a button to choose more.
 */
export default function GuestContactsScreen() {
  const styles = useStyles();
  const { t } = useLocale();
  const { wedding } = useWeddingPlan();
  const guests = useGuests(wedding?.id ?? null);
  const add = useAddGuests();
  const [access, setAccess] = useState<Access>('asking');
  // null until the phone's contacts have been read
  const [contacts, setContacts] = useState<PhoneGuest[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string>();

  const load = () => readContacts().then(setContacts, () => setAccess('failed'));

  useEffect(() => {
    if (Platform.OS === 'web') return;
    requestPermissionsAsync().then(
      (permission) => {
        if (!permission.granted) {
          setAccess('denied');
          return;
        }
        setAccess(permission.accessPrivileges === 'limited' ? 'limited' : 'all');
        readContacts().then(setContacts, () => setAccess('failed'));
      },
      () => setAccess('failed'),
    );
  }, []);

  // A number already on the list stays one guest (the database keeps one per phone)
  const onList = new Set((guests.data ?? []).map((guest) => guest.phone));
  const isOnList = (contact: PhoneGuest) => !!contact.phone && onList.has(contact.phone);
  const items = (contacts ?? []).map((contact) => ({
    id: contact.id,
    name: contact.name,
    locked: isOnList(contact),
    detail: isOnList(contact)
      ? t('guests.contacts.onList')
      : contact.phone
        ? formatPhone(contact.phone)
        : (contact.email ?? undefined),
  }));
  const ticked = new Set(picked);
  const chosen = (contacts ?? []).filter((contact) => ticked.has(contact.id) && !isOnList(contact));

  const save = () => {
    if (!wedding) return;
    setError(undefined);
    add.mutate(
      { weddingId: wedding.id, guests: chosen.map(({ id: _id, ...guest }) => guest) },
      {
        onSuccess: () => {
          successHaptic();
          closeGuestSheet();
        },
        onError: (e) => setError(t(`guests.errors.${guestErrorKind(e)}`)),
      },
    );
  };

  const byHand = (
    <Button
      variant="secondary"
      label={t('guests.byHand')}
      onPress={() => router.replace('/guest')}
    />
  );

  let empty = null;
  let footer;
  if (Platform.OS === 'web') {
    empty = (
      <StateView state="empty" icon="phone-portrait-outline" message={t('guests.contacts.web')} />
    );
    footer = byHand;
  } else if (access === 'asking') {
    empty = <StateView state="loading" />;
    footer = byHand;
  } else if (access === 'denied' || access === 'failed') {
    empty = (
      <StateView
        state="empty"
        icon="lock-closed-outline"
        message={t(access === 'denied' ? 'guests.contacts.denied' : 'guests.contacts.failed')}
      />
    );
    footer = (
      <>
        {access === 'denied' && (
          <Button
            label={t('guests.contacts.openSettings')}
            onPress={() => void Linking.openSettings()}
          />
        )}
        {byHand}
      </>
    );
  } else {
    empty =
      contacts === null ? (
        <StateView state="loading" />
      ) : (
        <StateView state="empty" icon="people-outline" message={t('guests.contacts.none')} />
      );
    footer = (
      <>
        {error && <FieldError message={error} />}
        <Button
          icon="person-add-outline"
          label={
            chosen.length > 0
              ? t('guests.contacts.add', { count: chosen.length })
              : t('guests.contacts.tick')
          }
          disabled={chosen.length === 0}
          loading={add.isPending}
          onPress={save}
        />
      </>
    );
  }

  return (
    <PickSheet
      title={t('guests.contacts.title')}
      intro={t('guests.contacts.intro')}
      items={items}
      picked={picked}
      onChange={setPicked}
      empty={empty}
      footer={footer}
    >
      {access === 'limited' && (
        <View style={styles.limited}>
          <AppText variant="label" weight={400} color="text2">
            {t('guests.contacts.limited')}
          </AppText>
          <Button
            variant="secondary"
            icon="people-outline"
            label={t('guests.contacts.chooseMore')}
            onPress={() => void Contact.presentAccessPicker().then(load, load)}
          />
        </View>
      )}
    </PickSheet>
  );
}

const useStyles = makeStyles((Colors) => ({
  limited: {
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
}));
