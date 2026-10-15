import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { FieldError } from '@/components/field-error';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { SheetHeader } from '@/components/sheet-header';
import { StateView } from '@/components/state-view';
import { TextField } from '@/components/text-field';
import { Spacing, useColors } from '@/constants/theme';
import { useVendor } from '@/data/vendors';
import { suggestErrorKind, useSuggestVendor } from '@/data/wedding-suggestions';
import { usePlanView } from '@/features/planner/use-plan-view';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic, successHaptic } from '@/lib/haptics';

/**
 * "Suggest for our wedding" (a modal, from a vendor's page): someone who can
 * suggest on the family's shared plan picks the event, the vendor type (when
 * the vendor does more than one thing) and an optional note. The owner or an
 * editor then accepts or declines it on My Wedding.
 * `?vendor={slug}` is required; `?event=` preselects the event.
 */
export default function SuggestScreen() {
  const Colors = useColors();
  const { t } = useLocale();
  const { vendor: slug = '', event } = useLocalSearchParams<{ vendor?: string; event?: string }>();
  const vendor = useVendor(slug);
  const view = usePlanView();
  const suggest = useSuggestVendor();
  const [eventSlug, setEventSlug] = useState<string | null>(null);
  const [categorySlug, setCategorySlug] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);

  const close = () => router.canGoBack() && router.back();
  const wedding = view.wedding;
  const events = view.chosen;
  const v = vendor.data;
  // Until they pick: the event they came from if it's in the plan, else the only one
  const pickedEvent =
    eventSlug ??
    (events.some((e) => e.slug === event) ? event! : events.length === 1 ? events[0].slug : null);
  const pickedCategory = categorySlug ?? v?.categories[0]?.slug ?? null;

  function send() {
    if (!wedding || !v || !pickedEvent || !pickedCategory) return;
    setError(undefined);
    suggest.mutate(
      {
        weddingId: wedding.id,
        eventSlug: pickedEvent,
        categorySlug: pickedCategory,
        vendorId: v.id,
        note,
      },
      {
        onSuccess: () => {
          successHaptic();
          setSent(true);
        },
        onError: (e) => setError(t(`suggestions.errors.${suggestErrorKind(e)}`)),
      },
    );
  }

  let content;
  if (vendor.isError || view.isError) {
    content = <StateView state="error" onRetry={() => void vendor.refetch()} />;
  } else if (vendor.isPending || view.isPending || !v) {
    content = <StateView state="loading" />;
  } else if (!wedding) {
    content = <StateView state="empty" message={t('suggestions.noPlan')} />;
  } else if (events.length === 0) {
    content = <StateView state="empty" message={t('suggestions.noEvents')} />;
  } else if (sent) {
    content = (
      <View style={styles.sent}>
        <Icon name="checkmark-circle" size={64} color={Colors.success} />
        <AppText variant="title" accessibilityRole="header" style={styles.center}>
          {t('suggestions.sent')}
        </AppText>
        <AppText color="text2" style={styles.center}>
          {t('suggestions.sentBody', { name: localized(v.name) })}
        </AppText>
        <Button label={t('suggestions.done')} onPress={close} style={styles.stretch} />
      </View>
    );
  } else {
    content = (
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.intro}>
          <AppText variant="title" accessibilityRole="header">
            {t('suggestions.sheetTitle', { name: localized(v.name) })}
          </AppText>
          <AppText color="text2">{t('suggestions.sheetSubtitle')}</AppText>
        </View>

        <View style={styles.group}>
          <AppText weight={600}>{t('suggestions.whichEvent')}</AppText>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {events.map((e) => (
              <Chip
                key={e.slug}
                role="radio"
                label={localized(e.name)}
                selected={pickedEvent === e.slug}
                onPress={() => {
                  selectionHaptic();
                  setEventSlug(e.slug);
                }}
              />
            ))}
          </View>
        </View>

        {v.categories.length > 1 && (
          <View style={styles.group}>
            <AppText weight={600}>{t('suggestions.whichType')}</AppText>
            <View style={styles.chips} accessibilityRole="radiogroup">
              {v.categories.map((c) => (
                <Chip
                  key={c.slug}
                  role="radio"
                  label={localized(c.name)}
                  selected={pickedCategory === c.slug}
                  onPress={() => {
                    selectionHaptic();
                    setCategorySlug(c.slug);
                  }}
                />
              ))}
            </View>
          </View>
        )}

        <TextField
          label={t('suggestions.noteLabel')}
          placeholder={t('suggestions.notePlaceholder')}
          value={note}
          onChangeText={setNote}
          maxLength={300}
          multiline
        />

        {error && <FieldError message={error} />}
        <Button
          icon="bulb-outline"
          label={t('suggestions.send')}
          disabled={!pickedEvent || !pickedCategory}
          loading={suggest.isPending}
          onPress={send}
        />
      </ScrollView>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <SheetHeader onClose={close} />
      {content}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  intro: {
    gap: Spacing.xs,
  },
  group: {
    gap: Spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  sent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  center: {
    textAlign: 'center',
  },
  stretch: {
    alignSelf: 'stretch',
    marginTop: Spacing.md,
  },
});
