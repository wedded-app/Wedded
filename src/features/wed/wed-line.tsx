import { Image } from 'expo-image';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { makeStyles, Radius, Spacing, useColors } from '@/constants/theme';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';
import { Motion } from '@/lib/motion';

import { openWed } from './open-wed';
import { type WedState, useWed } from './wed-store';
import { WedMark } from './wed-mark';

// Selectors out here, so useWed sees the same function every render
const waiting = (s: WedState) => s.approvals.filter((a) => a.stage === 'waiting');
const canApprove = (s: WedState) => s.role === 'owner';

/**
 * Wed on Home: one line, and only when Wed has found something that needs
 * the family's OK (the final look, 2026-10-23: nothing to say, nothing
 * shown). "Wed found 2 things", who they're about, two of their photos, and
 * an arrow; a tap opens Wed with the cards to say yes or not now.
 */
export function WedLine() {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const cards = useWed(waiting);
  const owner = useWed(canApprove);
  if (!owner || cards.length === 0) return null;

  const names = cards
    .map((card) => card.to[0]?.name)
    .filter(Boolean)
    .slice(0, 2)
    .join(' · ');
  const photos = cards
    .map((card) => card.to[0]?.photo)
    .filter((photo): photo is string => !!photo)
    .slice(0, 2);
  const title = t('home.wedLine.found', { count: cards.length });

  return (
    <Animated.View entering={Motion.rise} style={styles.wrap}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={names ? `${title}. ${names}` : title}
        accessibilityHint={t('home.wedLine.hint')}
        pressedScale={0.98}
        onPress={() => {
          selectionHaptic();
          openWed();
        }}
        style={styles.row}
      >
        <View style={styles.tile}>
          <WedMark size={26} color="ombre" />
          <View style={styles.count}>
            <AppText variant="caption" weight={700} color="onPrimary" maxFontSizeMultiplier={1.2}>
              {String(cards.length)}
            </AppText>
          </View>
        </View>
        <View style={styles.words}>
          <AppText weight={600} numberOfLines={1}>
            {title}
          </AppText>
          {!!names && (
            <AppText variant="caption" color="text2" numberOfLines={1}>
              {names}
            </AppText>
          )}
        </View>
        {photos.length > 0 && (
          <View style={styles.faces}>
            {photos.map((photo, i) => (
              <Image
                key={photo}
                source={{ uri: photo }}
                contentFit="cover"
                style={[styles.face, i > 0 && styles.faceBehind]}
              />
            ))}
          </View>
        )}
        <View style={styles.arrow}>
          <Icon name="arrow-forward" size={16} color={Colors.onPrimary} weight="semibold" />
        </View>
      </PressableScale>
    </Animated.View>
  );
}

const useStyles = makeStyles((Colors) => ({
  wrap: {
    marginTop: -Spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.sm,
    paddingRight: Spacing.md,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    borderColor: Colors.primaryTint,
    backgroundColor: Colors.bg,
    boxShadow: '0 10px 26px rgba(138, 28, 48, 0.12)',
  },
  tile: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryTint,
  },
  count: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: Colors.bg,
  },
  words: {
    flex: 1,
    gap: 2,
  },
  faces: {
    flexDirection: 'row',
  },
  face: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: Colors.bg,
  },
  faceBehind: {
    marginLeft: -10,
  },
  arrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryFill,
  },
}));
