import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { makeStyles, Radius, Spacing, useColors } from '@/constants/theme';
import { useSession } from '@/features/auth/session';
import { hasDraftPlan, useWeddingDraft } from '@/features/home/wedding-draft';
import { useSaveDraftPlan } from '@/features/onboarding/save-draft';
import { useStartPlanning } from '@/features/onboarding/start';
import { useLocale } from '@/i18n/locale-context';

import { gradient } from './countdown-card';

/**
 * Where the countdown goes before there's a plan (My Wedding, Guests): the
 * same maroon card, saying what a plan gives you, and "Start planning",
 * which asks the first questions (no account needed). With a plan made
 * before signing in, kept on this phone, it offers to save that instead:
 * signing in, saving it, and showing it here.
 */
export function StartPlanCard() {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const { requireSignIn } = useSession();
  const startPlanning = useStartPlanning();
  const drafted = hasDraftPlan(useWeddingDraft());
  const { save, saving } = useSaveDraftPlan();
  const [failed, setFailed] = useState(false);

  const onPress = drafted
    ? () =>
        requireSignIn(
          () => {
            setFailed(false);
            save()
              .then(() => router.navigate('/plan'))
              .catch(() => setFailed(true));
          },
          { reason: { kind: 'plan' } },
        )
    : startPlanning;

  return (
    <View style={[styles.card, gradient(Colors)]}>
      <Icon name="sparkles" size={120} color={Colors.onHero} style={styles.glow} />
      <View style={styles.words}>
        <AppText variant="title" weight={800} color="onHero" accessibilityRole="header">
          {drafted ? t('planner.savedCardTitle') : t('planner.startCardTitle')}
        </AppText>
        <AppText variant="bodyLg" color="onHero2">
          {failed
            ? t('home.dateCard.saveFailed')
            : drafted
              ? t('planner.savedCardBody')
              : t('planner.startCardBody')}
        </AppText>
      </View>
      <PressableScale
        accessibilityRole="button"
        accessibilityState={{ busy: saving }}
        disabled={saving}
        onPress={onPress}
        pressedScale={0.96}
        style={styles.button}
      >
        {saving ? (
          <ActivityIndicator color={Colors.heroFrom} />
        ) : (
          <AppText variant="button" weight={700} style={{ color: Colors.heroFrom }}>
            {drafted ? t('home.savePlan.save') : t('planner.startPlanning')}
          </AppText>
        )}
      </PressableScale>
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  card: {
    gap: Spacing.lg,
    padding: Spacing.xl,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.heroFrom,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: -14,
    right: -18,
    opacity: 0.12,
  },
  words: {
    gap: Spacing.xs,
  },
  button: {
    alignSelf: 'flex-start',
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.button,
    backgroundColor: Colors.onHero,
  },
}));
