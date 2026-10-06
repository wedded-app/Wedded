import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { makeStyles, Radius, Spacing, useColors } from '@/constants/theme';
import { useSession } from '@/features/auth/session';
import { useStartPlanning } from '@/features/onboarding/start';
import { useLocale } from '@/i18n/locale-context';

import { gradient } from './countdown-card';

/**
 * Where the countdown goes before there's a plan (Home, My Wedding): the same
 * maroon card, saying what a plan gives you, and "Start planning", which
 * signs them in first if needed (a plan belongs to an account), then asks
 * the three first questions.
 */
export function StartPlanCard() {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const { status } = useSession();
  const startPlanning = useStartPlanning();

  return (
    <View style={[styles.card, gradient(Colors)]}>
      <Icon name="sparkles" size={120} color={Colors.onHero} style={styles.glow} />
      <View style={styles.words}>
        <AppText variant="title" weight={800} color="onHero" accessibilityRole="header">
          {t('planner.startCardTitle')}
        </AppText>
        <AppText variant="bodyLg" color="onHero2">
          {t('planner.startCardBody')}
        </AppText>
      </View>
      <PressableScale
        accessibilityRole="button"
        onPress={startPlanning}
        pressedScale={0.96}
        style={styles.button}
      >
        <AppText variant="button" weight={700} style={{ color: Colors.heroFrom }}>
          {status === 'signedIn' ? t('planner.startPlanning') : t('planner.signInToPlan')}
        </AppText>
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
