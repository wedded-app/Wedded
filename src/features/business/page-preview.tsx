import { Image } from 'expo-image';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { makeStyles, Radius, Spacing, useColors } from '@/constants/theme';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';

// Dark at the bottom, so the white name reads on any photo
const SHADE = 'linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.65) 100%)';

/**
 * The top of My page (the final look, 2026-10-23): the vendor's page as
 * families see it, the cover photo with the name and the line under it. A
 * tap opens the real page (or the editor while it isn't live yet).
 */
export function PagePreview({
  name,
  line,
  coverUrl,
  live,
  onPress,
}: {
  name: string;
  line: string | null;
  coverUrl: string | null;
  live: boolean;
  onPress: () => void;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const action = live ? t('business.myPage.seeIt') : t('business.myPage.finishIt');

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${action}`}
      pressedScale={0.98}
      onPress={() => {
        selectionHaptic();
        onPress();
      }}
      style={styles.card}
    >
      {coverUrl ? (
        <Image
          source={{ uri: coverUrl }}
          contentFit="cover"
          transition={200}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.noPhoto]}>
          <Icon name="images-outline" size={40} color={Colors.text2} />
        </View>
      )}
      <View style={[StyleSheet.absoluteFill, shade]} />
      <View style={styles.pill}>
        <View style={[styles.dot, { backgroundColor: live ? Colors.success : Colors.accent }]} />
        <AppText variant="caption" weight={700}>
          {live ? t('business.myPage.live') : t('business.myPage.notLive')}
        </AppText>
      </View>
      <View style={styles.words}>
        <AppText weight={700} style={styles.name} numberOfLines={2}>
          {name}
        </AppText>
        {line && (
          <AppText weight={500} style={styles.line} numberOfLines={1}>
            {line}
          </AppText>
        )}
        <View style={styles.action}>
          <AppText variant="label" weight={600} style={styles.white}>
            {action}
          </AppText>
          <Icon name="arrow-forward" size={16} color="#FFFFFF" weight="semibold" />
        </View>
      </View>
    </PressableScale>
  );
}

const shade = (Platform.OS === 'web'
  ? { backgroundImage: SHADE }
  : { experimental_backgroundImage: SHADE }) as unknown as ViewStyle;

const useStyles = makeStyles((Colors) => ({
  card: {
    aspectRatio: 4 / 3,
    justifyContent: 'space-between',
    padding: Spacing.lg,
    overflow: 'hidden',
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  noPhoto: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    minHeight: 28,
    borderRadius: Radius.chip,
    backgroundColor: Colors.bg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  words: {
    gap: 2,
  },
  name: {
    color: '#FFFFFF',
    fontSize: 26,
    lineHeight: 31,
    letterSpacing: -0.3,
  },
  line: {
    color: 'rgba(255,255,255,0.9)',
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  white: {
    color: '#FFFFFF',
  },
}));
