import { Image } from 'expo-image';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { groupIcon } from '@/components/group-icon';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { makeStyles, Spacing, useColors } from '@/constants/theme';
import type { EventNeed } from '@/data/reference';
import { localized } from '@/i18n/localized';
import { selectionHaptic } from '@/lib/haptics';

import { KIND_PHOTOS } from './kind-photos';

/**
 * One kind of vendor as a round photo with its name under it (Browse
 * categories, All categories). A kind with no photo shows its group's icon.
 */
export function KindCircle({
  kind,
  size,
  width,
  onPress,
}: {
  kind: EventNeed;
  /** Across the circle. */
  size: number;
  /** Across the whole button, name included. */
  width: number;
  onPress: () => void;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const name = localized(kind.name);
  const photo = KIND_PHOTOS[kind.categorySlug];

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={name}
      pressedScale={0.95}
      onPress={() => {
        selectionHaptic();
        onPress();
      }}
      style={[styles.item, { width }]}
    >
      <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
        {photo ? (
          <Image source={photo} contentFit="cover" accessible={false} style={styles.fill} />
        ) : (
          <Icon
            name={groupIcon(kind.groupSlug)}
            size={Math.round(size * 0.38)}
            color={Colors.primary}
          />
        )}
      </View>
      <AppText variant="label" weight={500} numberOfLines={2} style={styles.name}>
        {name}
      </AppText>
    </PressableScale>
  );
}

const useStyles = makeStyles((Colors) => ({
  item: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  circle: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.sand,
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  name: {
    textAlign: 'center',
  },
}));
