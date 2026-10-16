import { Image } from 'expo-image';
import { Platform, Pressable, View, type ViewStyle } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon, type IconName } from '@/components/icon';
import { makeStyles, useColors } from '@/constants/theme';

export type StoryRingProps = {
  /** The photo in the circle; an icon when there is none. */
  photoUrl?: string | null;
  icon?: IconName;
  label: string;
  /** Grey ring once watched, as on Instagram. */
  seen?: boolean;
  size?: number;
  accessibilityLabel: string;
  onPress: () => void;
};

// The unwatched ring runs from the app's maroon to marigold, the one place the
// brand's second colour shows (vision §4: marigold for small fills only).
const RING = 'linear-gradient(45deg, #F0A030 0%, #D9485F 50%, #8A1C30 100%)';
export const storyRingStyle = (
  Platform.OS === 'web' ? { backgroundImage: RING } : { experimental_backgroundImage: RING }
) as ViewStyle;

/**
 * A story circle: a round photo in a coloured ring with a short name under
 * it. Tapping opens the full-screen story viewer. Used in the profile
 * highlights; its ring colours also mark stories on Reels.
 */
export function StoryRing({
  photoUrl,
  icon = 'image-outline',
  label,
  seen = false,
  size = 68,
  accessibilityLabel,
  onPress,
}: StoryRingProps) {
  const Colors = useColors();
  const styles = useStyles();
  const inner = size - 8;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.item, { width: size + 12 }, pressed && styles.pressed]}
    >
      <View
        style={[
          styles.ring,
          { width: size, height: size, borderRadius: size / 2 },
          seen ? styles.seen : storyRingStyle,
        ]}
      >
        <View
          style={[styles.gap, { width: size - 4, height: size - 4, borderRadius: (size - 4) / 2 }]}
        >
          {photoUrl ? (
            <Image
              source={{ uri: photoUrl }}
              contentFit="cover"
              transition={150}
              accessible={false}
              style={{ width: inner, height: inner, borderRadius: inner / 2 }}
            />
          ) : (
            <View
              style={[styles.iconWell, { width: inner, height: inner, borderRadius: inner / 2 }]}
            >
              <Icon name={icon} size={inner * 0.42} color={Colors.primary} />
            </View>
          )}
        </View>
      </View>
      <AppText
        variant="caption"
        weight={500}
        numberOfLines={1}
        maxFontSizeMultiplier={1.2}
        style={styles.label}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

const useStyles = makeStyles((Colors) => ({
  item: {
    alignItems: 'center',
    gap: 4,
  },
  pressed: {
    opacity: 0.7,
  },
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  seen: {
    backgroundColor: Colors.separator,
  },
  gap: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bg,
  },
  iconWell: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryTint,
  },
  label: {
    textAlign: 'center',
    alignSelf: 'stretch',
  },
}));
