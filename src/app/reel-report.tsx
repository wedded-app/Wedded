import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { FieldError } from '@/components/field-error';
import { Icon } from '@/components/icon';
import { ListRow, ListSection } from '@/components/list';
import { Screen } from '@/components/screen';
import { SheetHeader } from '@/components/sheet-header';
import { TextField } from '@/components/text-field';
import { Spacing, useColors } from '@/constants/theme';
import { type ReportReason, type ReportTarget, useReport } from '@/data/reels';
import { useLocale } from '@/i18n/locale-context';
import { successHaptic } from '@/lib/haptics';

const REASONS: ReportReason[] = [
  'inappropriate',
  'privacy',
  'not_mine',
  'harassment',
  'spam',
  'other',
];

/**
 * Report a reel, a comment, a person or a story (App Store rule 1.2): pick a
 * reason, add a note if you like, and the founders review it. `?reel=`,
 * `?comment=`, `?user=` or `?story=`.
 */
export default function ReelReportScreen() {
  const Colors = useColors();
  const { t } = useLocale();
  const params = useLocalSearchParams<{
    reel?: string;
    comment?: string;
    user?: string;
    story?: string;
  }>();
  const report = useReport();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>();
  const close = () => router.canGoBack() && router.back();

  const target: ReportTarget | null = params.reel
    ? { reelId: params.reel }
    : params.comment
      ? { commentId: params.comment }
      : params.user
        ? { userId: params.user }
        : params.story
          ? { storyId: params.story }
          : null;

  const send = () => {
    if (!target || !reason) return;
    setError(undefined);
    report.mutate(
      { target, reason, note },
      {
        onSuccess: () => {
          successHaptic();
          setSent(true);
        },
        onError: (e) =>
          setError(e.message.includes('report_limit') ? t('report.limit') : t('report.failed')),
      },
    );
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <SheetHeader onClose={close} />
      {sent ? (
        <View style={styles.sent}>
          <Icon name="checkmark-circle" size={64} color={Colors.success} />
          <AppText variant="title" accessibilityRole="header" style={styles.center}>
            {t('report.thanks')}
          </AppText>
          <AppText color="text2" style={styles.center}>
            {t('report.thanksBody')}
          </AppText>
          <Button label={t('report.done')} onPress={close} style={styles.stretch} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.intro}>
            <AppText variant="title" accessibilityRole="header">
              {t('report.title')}
            </AppText>
            <AppText color="text2">{t('report.subtitle')}</AppText>
          </View>
          <ListSection>
            {REASONS.map((r) => (
              <ListRow
                key={r}
                title={t(`report.reasons.${r}`)}
                onPress={() => setReason(r)}
                accessibilityRole="radio"
                checked={reason === r}
              />
            ))}
          </ListSection>
          <TextField
            label={t('report.noteLabel')}
            value={note}
            onChangeText={setNote}
            maxLength={500}
            multiline
          />
          {error && <FieldError message={error} />}
          <Button
            variant="danger"
            label={t('report.send')}
            disabled={!reason || !target}
            loading={report.isPending}
            onPress={send}
          />
        </ScrollView>
      )}
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
