import { router } from 'expo-router';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { PressableScale } from '@/components/pressable-scale';
import { makeStyles, Palettes } from '@/constants/theme';
import { WedMark } from '@/features/wed/wed-mark';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';

const SIZE = 52;

/**
 * Wed's bow in the middle of business mode's tab bar (2026-10-23), as on
 * the planning side: a tap slides up Wed for the business. The count is how
 * many families wait for a reply.
 */
export function BusinessWedButton({ count }: { count: number }) {
  const styles = useStyles();
  const { t } = useLocale();
  const label = count > 0 ? t('businessWed.buttonWaiting', { count }) : t('businessWed.button');

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      pressedScale={0.9}
      onPress={() => {
        selectionHaptic();
        router.push('/business/wed');
      }}
      style={styles.button}
    >
      <WedMark size={36} color="ombre" />
      {count > 0 && (
        <View style={styles.badge}>
          <AppText variant="caption" weight={700} color="onPrimary" maxFontSizeMultiplier={1.2}>
            {count > 99 ? '99+' : String(count)}
          </AppText>
        </View>
      )}
    </PressableScale>
  );
}

const useStyles = makeStyles(() => ({
  button: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 0,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    // Maroon in both schemes: white on it is 9.2:1
    backgroundColor: Palettes.light.primary,
    borderWidth: 2,
    borderColor: Palettes.light.bg,
  },
}));
