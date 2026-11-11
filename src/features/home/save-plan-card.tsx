import { router } from 'expo-router';
import { useState } from 'react';
import { Image, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { FieldError } from '@/components/field-error';
import { makeStyles, Radius, Spacing } from '@/constants/theme';
import { useSession } from '@/features/auth/session';
import { useSaveDraftPlan } from '@/features/onboarding/save-draft';
import { useLocale } from '@/i18n/locale-context';
import { Motion } from '@/lib/motion';

const RIBBON = require('../../../assets/images/ribbon.png');

// Not now hides it until the app opens again, on every Home
let dismissed = false;

/**
 * Under a plan made before signing in, on Home: one quiet card saying it's
 * only on this phone so far. Save my plan signs them in, saves it and
 * opens it; Not now puts it away until the app next opens. It never pops
 * up, and the plan works without it.
 */
export function SavePlanCard() {
  const styles = useStyles();
  const { t } = useLocale();
  const { requireSignIn } = useSession();
  const { save, saving } = useSaveDraftPlan();
  const [hidden, setHidden] = useState(dismissed);
  const [failed, setFailed] = useState(false);

  if (hidden) return null;

  return (
    <Animated.View entering={Motion.rise} exiting={Motion.exit} style={styles.card}>
      <View style={styles.head}>
        <Image source={RIBBON} style={styles.ribbon} resizeMode="contain" accessible={false} />
        <View style={styles.words}>
          <AppText variant="heading" weight={600}>
            {t('home.savePlan.title')}
          </AppText>
          <AppText color="text2">{t('home.savePlan.body')}</AppText>
        </View>
      </View>
      {failed && <FieldError message={t('home.dateCard.saveFailed')} />}
      <View style={styles.buttons}>
        <View style={styles.grow}>
          <Button
            label={t('home.savePlan.save')}
            loading={saving}
            onPress={() =>
              requireSignIn(() => {
                setFailed(false);
                save()
                  .then(() => router.navigate('/plan'))
                  .catch(() => setFailed(true));
              })
            }
          />
        </View>
        <Button
          variant="plain"
          labelColor="text2"
          label={t('home.savePlan.notNow')}
          onPress={() => {
            dismissed = true;
            setHidden(true);
          }}
        />
      </View>
    </Animated.View>
  );
}

const useStyles = makeStyles((Colors) => ({
  card: {
    gap: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  ribbon: {
    width: 34,
    height: 29,
    marginTop: 2,
  },
  words: {
    flex: 1,
    gap: Spacing.xs,
  },
  buttons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  grow: {
    flex: 1,
  },
}));
