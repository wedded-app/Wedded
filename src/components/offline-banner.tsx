import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { makeStyles, Spacing, useColors } from '@/constants/theme';
import { useLocale } from '@/i18n/locale-context';
import { Motion } from '@/lib/motion';

const subscribe = (listener: () => void) => onlineManager.subscribe(listener);
const isOnline = () => onlineManager.isOnline();

/**
 * A slim bar under the status bar while the phone has no internet. Pages
 * keep what they last loaded, and reads wait instead of failing, so this
 * says why nothing new is coming; it goes once the phone is back online and
 * the waiting reads run (data/query-client.ts).
 */
export function OfflineBanner() {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const { top } = useSafeAreaInsets();
  const online = useSyncExternalStore(subscribe, isOnline, () => true);
  if (online) return null;

  return (
    <Animated.View
      entering={Motion.enter}
      exiting={Motion.exit}
      style={[styles.wrap, { top: top + Spacing.xs }]}
      pointerEvents="none"
    >
      <View style={styles.bar} accessibilityLiveRegion="polite" accessibilityRole="alert">
        <Icon name="cloud-offline-outline" size={18} color={Colors.bg} />
        <AppText variant="label" weight={600} color="bg" style={styles.text}>
          {t('offline.banner')}
        </AppText>
      </View>
    </Animated.View>
  );
}

const useStyles = makeStyles((Colors) => ({
  wrap: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    alignItems: 'center',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 999,
    // The text colour behind the page colour: dark in light mode, light in dark
    backgroundColor: Colors.text,
    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.2)',
  },
  text: {
    flexShrink: 1,
  },
}));
