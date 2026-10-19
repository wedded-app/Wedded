import { router } from 'expo-router';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { PressableScale } from '@/components/pressable-scale';
import { makeStyles, Palettes } from '@/constants/theme';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';

import { openWed } from './open-wed';
import { WedMark } from './wed-mark';

const SIZE = 46;

/**
 * Wed's button in the middle of the planning tabs' bar (TabBar's `center`),
 * level with the tabs: the ribbon in the brand's maroon-to-rose on a white
 * circle, like the app icon, in light and dark alike. A tap opens the Wed
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
      <WedMark size={28} color="ombre" />
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
    // Always white, like the app icon
    backgroundColor: Palettes.light.surface,
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.16), 0 0 0 0.5px rgba(0, 0, 0, 0.08)',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -7,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: Colors.errorFill,
    borderWidth: 2,
    borderColor: Palettes.light.surface,
  },
}));
