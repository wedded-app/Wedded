import { router } from 'expo-router';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { PressableScale } from '@/components/pressable-scale';
import { makeStyles, Palettes } from '@/constants/theme';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';

import { openWed } from './open-wed';
import { WedMark } from './wed-mark';

const SIZE = 52;

/**
 * Wed's button in the middle of the planning tabs' bar (TabBar's `center`),
 * level with the tabs: just the bow, in the brand's maroon-to-rose, straight
 * on the glass (the final look, 2026-10-23). A tap opens the Wed chat; press
 * and hold opens Wed's voice screen. The count is how many of Wed's cards
 * wait for the family's OK.
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
