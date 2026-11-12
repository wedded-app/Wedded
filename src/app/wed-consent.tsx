import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { FieldError } from '@/components/field-error';
import { IconLine } from '@/components/icon-line';
import { Screen } from '@/components/screen';
import { SheetHeader } from '@/components/sheet-header';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/features/auth/session';
import { answerAiConsent } from '@/features/wed/ai-consent';
import { useLocale } from '@/i18n/locale-context';

const SHARED = ['words', 'plan', 'guests'] as const;

/**
 * Asked once before Wed shares anything with an AI service (App Store rule
 * 5.1.2(i)): what is shared and with whom, then Allow or Not now. The answer
 * is kept on their account, so Allow asks them to sign in first. Opened by
 * requireAiConsent (src/features/wed/ai-consent.ts), which sends what they
 * were writing after a yes. Not shown while Wed is scripted.
 */
export default function WedConsentSheet() {
  const { t } = useLocale();
  const { requireSignIn, status } = useSession();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const answer = async (allowed: boolean) => {
    setBusy(true);
    setFailed(false);
    try {
      await answerAiConsent(allowed);
      close();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <SheetHeader onClose={close} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.block}>
          <AppText variant="title" accessibilityRole="header">
            {t('wedConsent.title')}
          </AppText>
          <AppText color="text2">{t('wedConsent.body')}</AppText>
        </View>
        <View style={styles.block}>
          <AppText weight={600}>{t('wedConsent.sharedTitle')}</AppText>
          {SHARED.map((item) => (
            <IconLine key={item} icon="checkmark" color="text">
              {t(`wedConsent.shared.${item}`)}
            </IconLine>
          ))}
        </View>
        <AppText color="text2">{t('wedConsent.change')}</AppText>
        {failed && <FieldError message={t('wedConsent.failed')} />}
        <View style={styles.block}>
          <Button
            label={t('wedConsent.allow')}
            loading={busy}
            disabled={busy}
            onPress={() => requireSignIn(() => void answer(true))}
          />
          {/* Signed out there's no account to keep a no on: closing is the no */}
          <Button
            variant="neutral"
            label={t('wedConsent.notNow')}
            disabled={busy}
            onPress={() => (status === 'signedIn' ? void answer(false) : close())}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  block: {
    gap: Spacing.md,
  },
});
