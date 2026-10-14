import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Chip } from '@/components/chip';
import { FieldError } from '@/components/field-error';
import { Icon } from '@/components/icon';
import { Segmented } from '@/components/segmented';
import { StateView } from '@/components/state-view';
import { TextField } from '@/components/text-field';
import { makeStyles, SchemeContext, Spacing, useColors } from '@/constants/theme';
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
import { GlassCard, GlowButton, NightScreen } from '@/features/requests/night';
import { RequestInvite } from '@/features/requests/request-invite';
import { perGuest } from '@/features/requests/requests-format';
import { useRequestWords } from '@/features/requests/use-request-words';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { successHaptic } from '@/lib/haptics';

const UNITS: ProposalUnit[] = ['event', 'person', 'plate', 'hour'];

/**
 * A vendor's one proposal to a family's request (#221), on the night page:
 * the request as an invitation at the top, then the price and what it's
 * per, a note, and a menu to attach. One per request, said before Send.
 * /business/propose?request={id}
 */
export default function ProposeSheet() {
  return (
    <SchemeContext.Provider value="dark">
      <Propose />
    </SchemeContext.Provider>
  );
}

function Propose() {
  const Colors = useColors();
  const styles = useStyles();
  const { t, locale } = useLocale();
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

  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState<ProposalUnit>(
    card && perGuest(words.group(card.categorySlug)) ? 'person' : 'event',
  );
  const [note, setNote] = useState('');
  const [menu, setMenu] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const close = () => router.canGoBack() && router.back();

  const closeButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('common.close')}
      onPress={close}
      hitSlop={6}
      style={({ pressed }) => [styles.circle, pressed && styles.pressed]}
    >
      <Icon name="close" size={22} color={Colors.text} weight="semibold" />
    </Pressable>
  );

  if (!card) {
    return (
      <NightScreen top={closeButton}>
        <StateView state="empty" icon="megaphone-outline" message={t('requests.gone')} />
      </NightScreen>
    );
  }

  const cents = dollarsToCents(price);
  const noteOk = note.trim().length >= 10;

  const submit = () => {
    setAttempted(true);
    if (cents === null || !noteOk) return;
    send.mutate(
      { requestId: request, priceCents: cents, priceUnit: unit, note: note.trim(), menuId: menu },
      {
        onSuccess: () => {
          successHaptic();
          close();
        },
      },
    );
  };

  return (
    <NightScreen
      top={<View style={styles.topRow}>{closeButton}</View>}
      eyebrow={t('propose.eyebrow', { name: card.familyName })}
      title={t('propose.title')}
      footer={
        <GlowButton
          icon="paper-plane-outline"
          label={t('propose.send')}
          loading={send.isPending}
          onPress={submit}
        />
      }
    >
      <RequestInvite
        eventName={card.eventName ? localized(card.eventName, locale) : null}
        headline={localized(card.categoryName, locale)}
        date={card.eventDate}
        facts={words.facts(card, card.miles)}
        note={card.note || null}
        footer={
          <AppText variant="label" weight={400} color="text2">
            {`${card.familyName} · ${card.city}`}
          </AppText>
        }
      />

      <GlassCard>
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
      </GlassCard>

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
                label={localized(m.name, locale)}
                selected={menu === m.id}
                onPress={() => setMenu(menu === m.id ? null : m.id)}
              />
            ))}
          </View>
        </View>
      )}

      <View style={styles.once}>
        <Icon name="sparkles" size={18} color={Colors.champagne} />
        <AppText variant="label" weight={400} color="text2" style={styles.grow}>
          {t('propose.once')}
        </AppText>
      </View>
      {send.isError && (
        <FieldError message={t(`requests.problems.${requestProblem(send.error)}`)} />
      )}
    </NightScreen>
  );
}

const useStyles = makeStyles((Colors) => ({
  topRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.nightCardStrong,
    borderWidth: 1,
    borderColor: Colors.nightLine,
  },
  pressed: {
    opacity: 0.7,
  },
  field: {
    gap: Spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  once: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  grow: {
    flex: 1,
  },
}));
