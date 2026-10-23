import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { makeStyles, Palettes, Timing } from '@/constants/theme';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';
import { iosEasing } from '@/lib/motion';

import { openWed } from './open-wed';
import { WedMark } from './wed-mark';

const SIZE = 52;
// How far the bow dips under the finger
const DIP = 0.88;

/**
 * Wed's button in the middle of the planning tabs' bar (TabBar's `center`),
 * level with the tabs: just the bow, in the brand's maroon-to-rose, straight
 * on the glass (the final look, 2026-10-23). A tap dips the bow (down in 100
 * ms, back in 220, on iOS's curve; it dims instead with Reduce Motion) and
 * slides Wed's sheet up over the tab (openWed); press and hold opens Wed's
 * voice screen. The count is how many of Wed's cards wait for the family's
 * OK.
 */
export function WedButton({ count }: { count: number }) {
  const styles = useStyles();
  const { t } = useLocale();
  const reduceMotion = useReducedMotion();
  const pressed = useSharedValue(0);
  const label = count > 0 ? t('wedButton.waiting', { count }) : t('wedButton.label');

  const dip = useAnimatedStyle(() =>
    reduceMotion
      ? { opacity: 1 - pressed.get() * 0.3 }
      : { transform: [{ scale: 1 - pressed.get() * (1 - DIP) }] },
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={t('wedButton.hint')}
      onPressIn={() => {
        pressed.set(withTiming(1, { duration: Timing.press, easing: iosEasing }));
      }}
      // All the way down first, so even a quick tap shows the dip
      onPressOut={() => {
        pressed.set(
          withSequence(
            withTiming(1, { duration: Timing.press, easing: iosEasing }),
            withTiming(0, { duration: Timing.quick, easing: iosEasing }),
          ),
        );
      }}
      onPress={() => {
        selectionHaptic();
        openWed();
      }}
      onLongPress={() => router.push('/wed-voice')}
      style={styles.button}
    >
      <Animated.View style={dip}>
        <WedMark size={36} color="ombre" />
      </Animated.View>
      {count > 0 && (
        <View style={styles.badge}>
          <AppText variant="caption" weight={700} color="onPrimary" maxFontSizeMultiplier={1.2}>
            {count > 99 ? '99+' : String(count)}
          </AppText>
        </View>
      )}
    </Pressable>
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
