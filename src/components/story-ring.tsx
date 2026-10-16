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
  /** Over a video (the Reels tab): white name, dark gap inside the ring. */
  onVideo?: boolean;
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
 * it. Tapping opens the full-screen story viewer. Used in the Reels tab's
 * stories row and the profile highlights.
 */
export function StoryRing({
  photoUrl,
  icon = 'image-outline',
  label,
  seen = false,
  size = 68,
  onVideo = false,
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
          style={[
            styles.gap,
            { width: size - 4, height: size - 4, borderRadius: (size - 4) / 2 },
            onVideo && styles.gapOnVideo,
          ]}
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
        color={onVideo ? 'onPhoto' : undefined}
        style={[styles.label, onVideo && styles.labelOnVideo]}
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
  gapOnVideo: {
    backgroundColor: '#000000',
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
  labelOnVideo: {
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
}));
