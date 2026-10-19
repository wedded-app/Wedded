import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { FieldError } from '@/components/field-error';
import { Screen } from '@/components/screen';
import { SheetHeader } from '@/components/sheet-header';
import { StateView } from '@/components/state-view';
import { Stepper } from '@/components/stepper';
import { TextField } from '@/components/text-field';
import { makeStyles, Spacing } from '@/constants/theme';
import {
  guestErrorKind,
  rsvpLink,
  useAddGuests,
  useGuests,
  useRemoveGuest,
  useUpdateGuest,
  type Guest,
} from '@/data/guests';
import { shareInvite, useWeddingPlan } from '@/data/wedding';
import { isValidEmail, normalizePhone } from '@/features/auth/about-you-validation';
import { closeGuestSheet, confirm } from '@/features/guests/pick-sheet';
import { useLocale } from '@/i18n/locale-context';
import { successHaptic } from '@/lib/haptics';
import { formatPhone } from '@/lib/phone';

/**
 * One guest, typed in by hand or changed (#308): a name, and if they have
 * them a phone and an email, and how many people the invite is for (a
 * household is one guest). /guest adds someone; /guest?id= changes them,
 * shares their RSVP link or takes them off the list.
 */
export default function GuestScreen() {
  const { t } = useLocale();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { wedding, loading } = useWeddingPlan();
  const guests = useGuests(wedding?.id ?? null);
  const guest = guests.data?.find((g) => g.id === id);

  let content;
  if (!wedding) {
    content = loading ? (
      <StateView state="loading" />
    ) : (
      <StateView state="empty" icon="people-outline" message={t('guests.form.noPlan')} />
    );
  } else if (id && guests.isPending) {
    content = <StateView state="loading" />;
  } else if (id && !guest) {
    content = <StateView state="empty" icon="person-outline" message={t('guests.form.gone')} />;
  } else {
    content = (
      <GuestForm
        key={guest?.id ?? 'new'}
        weddingId={wedding.id}
        guest={guest}
        others={guests.data ?? []}
      />
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <SheetHeader onClose={closeGuestSheet} />
      {content}
    </Screen>
  );
}

function GuestForm({
  weddingId,
  guest,
  others,
}: {
  weddingId: string;
  guest?: Guest;
  /** Everyone on the list, to catch a number that's already there. */
  others: Guest[];
}) {
  const styles = useStyles();
  const { t } = useLocale();
  const add = useAddGuests();
  const update = useUpdateGuest();
  const remove = useRemoveGuest();
  const [name, setName] = useState(guest?.name ?? '');
  const [phone, setPhone] = useState(guest?.phone ? formatPhone(guest.phone) : '');
  const [email, setEmail] = useState(guest?.email ?? '');
  const [partySize, setPartySize] = useState(guest?.partySize ?? 1);
  const [errors, setErrors] = useState<{ name?: string; phone?: string; email?: string }>({});
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);
  const failed = (e: unknown) => setError(t(`guests.errors.${guestErrorKind(e)}`));
  // Typing in a box clears its error, so a fixed name doesn't still say "Type their name"
  const edit =
    (field: 'name' | 'phone' | 'email', set: (text: string) => void) => (text: string) => {
      set(text);
      setErrors((current) => ({ ...current, [field]: undefined }));
    };

  const save = () => {
    const cleanName = name.trim().replace(/\s+/g, ' ');
    const cleanPhone = phone.trim() ? normalizePhone(phone) : null;
    const cleanEmail = email.trim().toLowerCase() || null;
    // Adding a number that's on the list already would quietly keep the old guest
    const twin = cleanPhone && others.find((o) => o.phone === cleanPhone && o.id !== guest?.id);
    const found = {
      name: cleanName ? undefined : t('guests.form.nameRequired'),
      phone:
        phone.trim() && !cleanPhone
          ? t('guests.form.phoneInvalid')
          : twin
            ? t('guests.form.phoneTaken', { name: twin.name })
            : undefined,
      email: cleanEmail && !isValidEmail(cleanEmail) ? t('guests.form.emailInvalid') : undefined,
    };
    setErrors(found);
    if (found.name || found.phone || found.email) return;
    setError(undefined);
    const values = { name: cleanName, phone: cleanPhone, email: cleanEmail, partySize };
    const done = {
      onSuccess: () => {
        successHaptic();
        closeGuestSheet();
      },
      onError: failed,
    };
    if (guest) update.mutate({ weddingId, id: guest.id, ...values }, done);
    else add.mutate({ weddingId, guests: [values] }, done);
  };

  const share = async (token: string) => {
    const result = await shareInvite(rsvpLink(token), t, 'guests.form.shareMessage');
    setCopied(result === 'copied');
  };

  const askRemove = (who: Guest) =>
    confirm(
      t('guests.form.removeTitle', { name: who.name }),
      t('guests.form.removeBody'),
      t('guests.form.remove'),
      t('guests.form.keep'),
      () =>
        remove.mutate({ weddingId, id: who.id }, { onSuccess: closeGuestSheet, onError: failed }),
    );

  return (
    <>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AppText variant="title" accessibilityRole="header" style={styles.pad}>
          {guest ? guest.name : t('guests.form.newTitle')}
        </AppText>
        <TextField
          label={t('guests.form.name')}
          hint={t('guests.form.nameHint')}
          type="name"
          value={name}
          onChangeText={edit('name', setName)}
          maxLength={80}
          error={errors.name}
        />
        <TextField
          label={t('guests.form.phone')}
          hint={t('guests.form.phoneHint')}
          type="phone"
          value={phone}
          onChangeText={edit('phone', setPhone)}
          error={errors.phone}
        />
        <TextField
          label={t('guests.form.email')}
          type="email"
          value={email}
          onChangeText={edit('email', setEmail)}
          maxLength={254}
          error={errors.email}
        />
        <View style={styles.party}>
          <AppText variant="label" weight={600} style={styles.pad}>
            {t('guests.form.party')}
          </AppText>
          <AppText color="text2" style={styles.pad}>
            {t('guests.form.partyHint')}
          </AppText>
          <Stepper
            value={partySize}
            min={1}
            max={20}
            onChange={setPartySize}
            accessibilityLabel={t('guests.form.party')}
          />
        </View>
        {guest && (
          <View style={styles.party}>
            <Button
              variant="secondary"
              icon="share-outline"
              label={t('guests.form.share')}
              onPress={() => void share(guest.rsvpToken)}
            />
            {copied && (
              <AppText color="success" style={styles.pad}>
                {t('guests.form.copied')}
              </AppText>
            )}
            <Button
              variant="text"
              labelColor="error"
              label={t('guests.form.remove')}
              loading={remove.isPending}
              onPress={() => askRemove(guest)}
            />
          </View>
        )}
      </ScrollView>
      <View style={styles.footer}>
        {error && <FieldError message={error} />}
        <Button
          label={guest ? t('guests.form.save') : t('guests.form.add')}
          loading={add.isPending || update.isPending}
          onPress={save}
        />
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
  party: {
    gap: Spacing.sm,
  },
  footer: {
    gap: Spacing.sm,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
    backgroundColor: Colors.bg,
  },
}));
