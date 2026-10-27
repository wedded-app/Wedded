import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { makeStyles, Spacing, useColors } from '@/constants/theme';
import { useGuestLists, useGuestSummary } from '@/data/guests';
import type { MemoryVault } from '@/data/memory-vault';
import { openWed } from '@/features/wed/open-wed';
import type { GuestSend } from '@/features/wed/send-to-guests';
import { wed } from '@/features/wed/wed-store';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

/**
 * "Send to your guests" under the vault's Share (#321): pick who (everyone
 * invited to one event, or a guest list), and Wed shows the same confirm card
 * as "Send the Memory Vault link to everyone at the Reception" (#129). After
 * Send and the 10 seconds for Undo, Messages or Mail opens with a fresh link.
 */
export function SendToGuests({ vault }: { vault: MemoryVault }) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const summary = useGuestSummary(open ? vault.weddingId : null);
  const lists = useGuestLists(open ? vault.weddingId : null);
  const invited = new Set(
    (summary.data ?? []).filter((e) => e.invited > 0).map((e) => e.eventSlug),
  );
  const events = vault.events.filter((event) => invited.has(event.slug));
  const guestLists = lists.data ?? [];

  // This vault's own wedding, and the card the store made, which may be "send-vault-2"
  const send = (to: GuestSend['to']) =>
    openWed({
      focus: wed.sendToGuests({
        to,
        events: [],
        vault: true,
        channel: 'each',
        weddingId: vault.weddingId,
      }),
    });

  let choices = null;
  if (summary.isPending || lists.isPending) {
    choices = <ActivityIndicator color={Colors.text2} />;
  } else if (events.length === 0 && guestLists.length === 0) {
    choices = <AppText color="text2">{t('memoryVault.send.noGuests')}</AppText>;
  } else {
    choices = (
      <>
        <AppText variant="label" weight={600} color="text2">
          {t('memoryVault.send.who')}
        </AppText>
        <View style={styles.chips}>
          {events.map((event) => (
            <Chip
              key={event.slug}
              role="button"
              label={t('memoryVault.send.event', { event: localized(event.name) })}
              onPress={() => send({ event: event.slug })}
            />
          ))}
          {guestLists.map((list) => (
            <Chip
              key={list.id}
              role="button"
              label={list.name}
              onPress={() => send({ list: list.name })}
            />
          ))}
        </View>
      </>
    );
  }

  return (
    <View style={styles.wrap}>
      <Button
        variant="secondary"
        icon="paper-plane-outline"
        label={t('memoryVault.send.title')}
        onPress={() => setOpen(!open)}
      />
      {open && choices}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  wrap: {
    gap: Spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
}));
