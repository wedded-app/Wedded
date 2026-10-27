import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { FieldError } from '@/components/field-error';
import { IconLine } from '@/components/icon-line';
import { Screen } from '@/components/screen';
import { SheetHeader } from '@/components/sheet-header';
import { Sizes, Spacing } from '@/constants/theme';
import {
  useInviteToEvent,
  useLogInviteSends,
  useWeddingRsvpToken,
  weddingRsvpLink,
} from '@/data/guests';
import { useCreateVaultInvite, useOpenMemoryVault } from '@/data/memory-vault';
import { cardFile } from '@/features/cards/card-export';
import { whoOf } from '@/features/wed/guest-details';
import { useGuestList } from '@/features/wed/guest-list';
import { WED_HREF } from '@/features/wed/open-wed';
import { batches, canSend, firstName, linkFor, openComposer } from '@/features/wed/send-to-guests';
import { useCardRefs, useWedCards, WedCards } from '@/features/wed/wed-cards';
import { useWed, wed } from '@/features/wed/wed-store';
import { useLocale } from '@/i18n/locale-context';
import { successHaptic } from '@/lib/haptics';

// The one native-stack event this sheet waits for
type Sheet = {
  addListener: (
    event: 'transitionEnd',
    run: (e: { data: { closing: boolean } }) => void,
  ) => () => void;
};

/**
 * Sending to guests (/wed-send?id=…), opened by Wed once a send-to-guests
 * card's 10 seconds for Undo are up. For cards it first invites the guests
 * to the cards' events, so each one's RSVP link shows them; for the Memory
 * Vault it opens the vault if need be and makes a link. Then it opens
 * Messages (or Mail) filled in, the cards attached: for "Text each person"
 * one guest at a time, "Sending 3 of 40", with Skip and Stop between them;
 * otherwise everyone at once. The phone's own Send button is the final
 * say, and each invitation that goes is logged for the guest list.
 */
export default function WedSendSheet() {
  const { t } = useLocale();
  const { width: screen } = useWindowDimensions();
  const navigation = useNavigation<Sheet>();
  const { id } = useLocalSearchParams<{ id: string }>();
  const send = useWed((s) => s.approvals.find((a) => a.id === id)?.guests);
  const message = useWed((s) => s.approvals.find((a) => a.id === id)?.message ?? '');
  const list = useGuestList(send);
  const weddingToken = useWeddingRsvpToken(list.status === 'ready' ? list.weddingId : null);
  const invite = useInviteToEvent();
  const logSends = useLogInviteSends();
  const openVault = useOpenMemoryVault();
  const vaultLink = useCreateVaultInvite();
  const cards = useWedCards(send?.events ?? []);
  const refs = useCardRefs(cards?.length ?? 0);

  // Once, before the first message opens: the invites, then the cards as files or the vault's link
  const prepared = useRef<{ files: string[]; vaultUrl: string | null } | null>(null);
  const [next, setNext] = useState(0);
  const [sent, setSent] = useState(0);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  // The phone can't show Messages over a sheet that's still sliding up
  const [shown, setShown] = useState(false);

  const channel = send?.channel ?? 'each';
  const steps = useMemo(
    () => (list.status === 'ready' ? batches(channel, list.recipients) : []),
    [channel, list],
  );
  const people = steps.reduce((sum, to) => sum + to.length, 0);
  const done = steps.length > 0 && next >= steps.length;

  useEffect(() => {
    void canSend(channel).then(setAvailable);
  }, [channel]);

  useEffect(
    () =>
      navigation.addListener('transitionEnd', (event) => {
        if (!event.data.closing) setShown(true);
      }),
    [navigation],
  );

  const close = () => (router.canGoBack() ? router.back() : router.replace(WED_HREF));

  // "on your Mehndi list" or "at the Reception", for what the sheet says
  const who = send ? whoOf(send.to) : null;
  const whoWords = who
    ? t(`wedSend.who.${who.key}`, { ...who.words, list: list.status === 'ready' ? list.name : '' })
    : '';

  // What happened goes in Wed's thread, then the sheet closes
  const finish = () => {
    const words = sent === 0 ? 'nothing' : channel === 'email' ? 'emailed' : 'texted';
    wed.note(t(`wedSend.receipt.${words}`, { sent, count: people, who: whoWords }));
    close();
  };

  async function openNext() {
    if (list.status !== 'ready' || !send || done) return;
    const to = steps[next];
    setBusy(true);
    setFailed(false);
    try {
      if (prepared.current === null) {
        if (send.vault) {
          // The same vault when it's already open; every link is a new one
          const vaultId = await openVault.mutateAsync(list.weddingId);
          prepared.current = { files: [], vaultUrl: await vaultLink.mutateAsync(vaultId) };
        } else {
          // Only the events in the family's plan can have invites
          const events = send.events.filter((slug) => list.events.includes(slug));
          const guests = list.listId
            ? { listId: list.listId }
            : { guestIds: list.recipients.map((r) => r.id) };
          for (const eventSlug of events) {
            await invite.mutateAsync({ weddingId: list.weddingId, eventSlug, ...guests });
          }
          prepared.current = {
            files: await Promise.all(refs.map((card) => cardFile(card))),
            vaultUrl: null,
          };
        }
      }
      const link = linkFor(
        send,
        to,
        prepared.current.vaultUrl,
        weddingRsvpLink(weddingToken.data ?? null),
      );
      const body = link ? `${message}\n\n${t(`wedSend.${link.line}`, { url: link.url })}` : message;
      const subject = t(send.vault ? 'wedSend.vaultSubject' : 'wedSend.subject');
      const result = await openComposer(channel, to, body, prepared.current.files, subject);
      if (result !== 'cancelled') {
        // Invitations only: the vault's link isn't one
        if (!send.vault) {
          logSends.mutate({
            weddingId: list.weddingId,
            guestIds: to.map((r) => r.id),
            channel: channel === 'email' ? 'email' : 'text',
          });
        }
        setSent((n) => n + to.length);
        if (next + 1 >= steps.length) successHaptic();
      }
      // A cancelled text to one person skips them; a cancelled group text or email can be opened again
      if (result !== 'cancelled' || channel === 'each') setNext((n) => n + 1);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  // Send on the card opens the first message: here, as soon as it can
  const openFirst = useEffectEvent(() => void openNext());
  const ready =
    list.status === 'ready' && steps.length > 0 && available === true && shown && !!cards;
  useEffect(() => {
    if (ready && prepared.current === null) openFirst();
  }, [ready]);

  const nextName = done || steps.length === 0 ? '' : firstName(steps[next][0].name);

  return (
    <Screen edges={['top', 'bottom']}>
      <SheetHeader onClose={steps.length > 0 ? finish : close} title={t('wedSend.title')} />
      <ScrollView contentContainerStyle={styles.content}>
        {!send ? (
          <AppText color="text2">{t('wedSend.gone')}</AppText>
        ) : list.status !== 'ready' || !who ? (
          <IconLine icon="people-outline" color="text2">
            {who ? t(`wedSend.${who.key}.${list.status}`, who.words) : ''}
          </IconLine>
        ) : steps.length === 0 ? (
          <AppText color="text2">
            {t(channel === 'email' ? 'wedSend.noneEmail' : 'wedSend.nonePhone', {
              who: whoWords,
            })}
          </AppText>
        ) : available === false ? (
          <AppText color="text2">{t(`wedSend.unavailable.${channel}`)}</AppText>
        ) : done ? (
          <View style={styles.block}>
            <AppText variant="heading" accessibilityRole="header">
              {t('wedSend.done', { sent, count: people })}
            </AppText>
            <Button label={t('wedSend.finish')} onPress={finish} />
          </View>
        ) : (
          <View style={styles.block}>
            <AppText variant="heading" accessibilityRole="header" accessibilityLiveRegion="polite">
              {channel === 'each'
                ? t('wedSend.progress', { at: next + 1, count: people })
                : t('wedSend.everyone', { count: people })}
            </AppText>
            <Button
              label={
                channel === 'each'
                  ? t('wedSend.textNext', { name: nextName })
                  : t(`wedSend.open.${channel}`)
              }
              loading={busy}
              disabled={busy}
              onPress={() => void openNext()}
            />
            {channel === 'each' && (
              <Button
                variant="neutral"
                label={t('wedSend.skip', { name: nextName })}
                disabled={busy}
                onPress={() => setNext((n) => n + 1)}
              />
            )}
            <Button
              variant="plain"
              labelColor="text2"
              label={t('wedSend.stop')}
              disabled={busy}
              onPress={finish}
            />
            {failed && <FieldError message={t('wedSend.failed')} />}
            <AppText variant="label" weight={400} color="text2">
              {t(`wedSend.yourSend.${channel}`)}
            </AppText>
          </View>
        )}
        {cards && !send?.vault && (
          <WedCards cards={cards} width={Math.min(320, screen * 0.8)} refs={refs} />
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.xl,
    padding: Sizes.pageGutter,
  },
  block: {
    gap: Spacing.md,
  },
});
