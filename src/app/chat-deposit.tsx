import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { FieldError } from '@/components/field-error';
import { Screen } from '@/components/screen';
import { SheetHeader } from '@/components/sheet-header';
import { TextField } from '@/components/text-field';
import { Spacing } from '@/constants/theme';
import { useConversation } from '@/data/chat';
import { depositProblem, dollarsToCents, formatCents, useRequestDeposit } from '@/data/deposits';
import { useEventNames } from '@/features/business/business-parts';
import { useLocale } from '@/i18n/locale-context';

/**
 * For a vendor whose payments are set up: ask the family for a deposit in
 * this chat (#209). The amount in dollars, which event (from what the family
 * asked about), and a note. /chat-deposit?id={conversation id}
 */
export default function ChatDepositSheet() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const { t } = useLocale();
  const eventName = useEventNames();
  const thread = useConversation(id);
  const request = useRequestDeposit(id);
  const [amount, setAmount] = useState('');
  const [event, setEvent] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [attempted, setAttempted] = useState(false);

  // The events this family asked about, in the order they came up
  const events = [
    ...new Set(
      thread.messages.flatMap((m) => (m.kind === 'booking' ? m.booking?.eventSlugs : []) ?? []),
    ),
  ];
  const cents = dollarsToCents(amount);

  function submit() {
    setAttempted(true);
    if (cents === null) return;
    request.mutate(
      { amountCents: cents, eventSlug: event, note: note.trim() || null },
      { onSuccess: () => router.back() },
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <SheetHeader onClose={() => router.canGoBack() && router.back()} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <View style={styles.intro}>
          <AppText variant="title" accessibilityRole="header">
            {t('chat.depositForm.title')}
          </AppText>
          <AppText color="text2">{t('chat.depositForm.body')}</AppText>
        </View>
        <TextField
          label={t('chat.depositForm.amount')}
          hint={t('chat.depositForm.amountHint')}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          error={attempted && cents === null ? t('chat.depositForm.amountError') : undefined}
          maxLength={10}
        />
        {events.length > 0 && (
          <View style={styles.field}>
            <AppText variant="label" weight={600}>
              {t('chat.depositForm.event')}
            </AppText>
            <View style={styles.chips}>
              {events.map((slug) => (
                <Chip
                  key={slug}
                  label={eventName(slug)}
                  selected={event === slug}
                  onPress={() => setEvent(event === slug ? null : slug)}
                />
              ))}
            </View>
          </View>
        )}
        <TextField
          label={t('chat.depositForm.note')}
          hint={t('chat.depositForm.noteHint')}
          value={note}
          onChangeText={setNote}
          multiline
          maxLength={500}
        />
        {request.isError && (
          <FieldError message={t(`chat.deposit.problems.${depositProblem(request.error)}`)} />
        )}
        <Button
          label={
            cents === null
              ? t('chat.depositForm.send')
              : t('chat.depositForm.sendAmount', { amount: formatCents(cents) })
          }
          loading={request.isPending}
          onPress={submit}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xxl,
  },
  intro: {
    gap: Spacing.xs,
  },
  field: {
    gap: Spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
});
