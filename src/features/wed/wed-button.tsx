import { router } from 'expo-router';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { PressableScale } from '@/components/pressable-scale';
import { makeStyles, Spacing } from '@/constants/theme';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';

import { openWed } from './open-wed';
import { WedMark } from './wed-mark';

const SIZE = 60;

/** How much taller the tab bar's area is with the button above it, for content to clear. */
export const WED_BUTTON_SPACE = SIZE + Spacing.md;

/**
 * Wed's floating button, just above the right end of the planning tabs'
 * bar (it took Wed's tab, so Requests could have one). A tap opens the Wed
 * chat; press and hold opens Wed's voice screen. The red count is how many
 * of Wed's cards wait for the family's OK.
 */
export function WedButton({ count }: { count: number }) {
  const styles = useStyles();
  const { t } = useLocale();
  const label = count > 0 ? t('wedButton.waiting', { count }) : t('wedButton.label');

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={t('wedButton.hint')}
      pressedScale={0.94}
      onPress={() => {
        selectionHaptic();
        openWed();
      }}
      onLongPress={() => router.push('/wed-voice')}
      style={styles.button}
    >
      <WedMark size={30} color="onPrimary" />
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

const useStyles = makeStyles((Colors) => ({
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    boxShadow: '0 6px 18px rgba(0, 0, 0, 0.28)',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: Colors.errorFill,
    borderWidth: 2,
    borderColor: Colors.surface,
  },
}));
