import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { FieldError } from '@/components/field-error';
import { Screen } from '@/components/screen';
import { Segmented } from '@/components/segmented';
import { SheetHeader } from '@/components/sheet-header';
import { StateView } from '@/components/state-view';
import { TextField } from '@/components/text-field';
import { makeStyles, Radius, Spacing } from '@/constants/theme';
import { dollarsToCents } from '@/data/deposits';
import {
  type LookingCard,
  type ProposalUnit,
  requestKeys,
  requestProblem,
  useSendProposal,
} from '@/data/requests';
import { useVendorMenus } from '@/data/vendor-menus';
import { useCurrentBusiness } from '@/features/business/use-current-business';
import { LookingPost } from '@/features/requests/request-parts';
import { useRequestWords } from '@/features/requests/use-request-words';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

const UNITS: ProposalUnit[] = ['event', 'person', 'plate', 'hour'];

/**
 * A vendor's one proposal to a family's request (#221): the request at the
 * top, then a price (for the event, per person, per plate or per hour), a
 * note, and a menu to attach. One per request, so it says that before Send.
 * /business/propose?request={id}
 */
export default function ProposeSheet() {
  const styles = useStyles();
  const { t } = useLocale();
  const { request = '' } = useLocalSearchParams<{ request: string }>();
  const { vendorId } = useCurrentBusiness();
  const words = useRequestWords();
  const menus = useVendorMenus(vendorId);
  const send = useSendProposal(vendorId);
  const queryClient = useQueryClient();
  // The card the vendor tapped, from the feed already on the phone
  const card = queryClient
    .getQueriesData<InfiniteData<LookingCard[]>>({
      queryKey: [...requestKeys.all, 'looking', vendorId],
    })
    .flatMap(([, data]) => data?.pages.flat() ?? [])
    .find((c) => c.id === request);

  const perGuest = card
    ? words.group(card.categorySlug) === 'food' || words.group(card.categorySlug) === 'venues'
    : false;
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState<ProposalUnit>(perGuest ? 'person' : 'event');
  const [note, setNote] = useState('');
  const [menu, setMenu] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);

  if (!card)
    return <StateView state="empty" icon="megaphone-outline" message={t('requests.gone')} />;

  const cents = dollarsToCents(price);
  const noteOk = note.trim().length >= 10;

  const submit = () => {
    setAttempted(true);
    if (cents === null || !noteOk) return;
    send.mutate(
      { requestId: request, priceCents: cents, priceUnit: unit, note: note.trim(), menuId: menu },
      { onSuccess: () => router.back() },
    );
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <SheetHeader onClose={() => router.canGoBack() && router.back()} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <AppText variant="title" accessibilityRole="header">
          {t('propose.title')}
        </AppText>
        <View style={styles.request}>
          <LookingPost
            familyName={card.familyName}
            city={card.city}
            headline={words.headline(card)}
            facts={words.facts(card, card.miles)}
            note={card.note}
          />
        </View>

        <TextField
          label={t('propose.price')}
          value={price}
          onChangeText={setPrice}
          keyboardType="decimal-pad"
          maxLength={10}
          error={attempted && cents === null ? t('propose.priceError') : undefined}
        />
        <View style={styles.field}>
          <AppText variant="label" weight={600}>
            {t('propose.per')}
          </AppText>
          <Segmented<ProposalUnit>
            accessibilityLabel={t('propose.per')}
            value={unit}
            onChange={setUnit}
            options={UNITS.map((u) => ({ value: u, label: t(`requests.unitShort.${u}`) }))}
          />
        </View>
        <TextField
          label={t('propose.note')}
          hint={t('propose.noteHint')}
          value={note}
          onChangeText={setNote}
          multiline
          maxLength={800}
          error={attempted && !noteOk ? t('propose.noteError') : undefined}
        />

        {(menus.data?.length ?? 0) > 0 && (
          <View style={styles.field}>
            <AppText variant="label" weight={600}>
              {t('propose.menu')}
            </AppText>
            <View style={styles.chips}>
              {menus.data?.map((m) => (
                <Chip
                  key={m.id}
                  label={localized(m.name)}
                  selected={menu === m.id}
                  onPress={() => setMenu(menu === m.id ? null : m.id)}
                />
              ))}
            </View>
          </View>
        )}

        <AppText variant="label" weight={400} color="text2">
          {t('propose.once')}
        </AppText>
        {send.isError && (
          <FieldError message={t(`requests.problems.${requestProblem(send.error)}`)} />
        )}
        <Button
          icon="paper-plane-outline"
          label={t('propose.send')}
          loading={send.isPending}
          onPress={submit}
        />
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((Colors) => ({
  content: {
    gap: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xxl,
  },
  request: {
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  field: {
    gap: Spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
}));
