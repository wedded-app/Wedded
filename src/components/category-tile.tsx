import { View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText, useFontScale } from '@/components/app-text';
import { Card } from '@/components/card';
import { Icon, type IconName } from '@/components/icon';
import { makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import { type LocalizedText, localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

export type CategoryTileProps = {
  /** The category's name from the database. */
  name: LocalizedText;
  /** Vendors in this category, e.g. 9. */
  vendorCount?: number;
  /** Whether the count is limited to the user's distance ("9 near you") or
   * everywhere ("9 vendors"). Pass false when no location is set. */
  nearYou?: boolean;
  /** Glyph at the top; a shop front when left out. */
  icon?: IconName;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * One vendor category: the app-colour glyph on a soft tint, the name in both
 * scripts, and a count. Made for a two-column grid (give each tile `flex: 1`);
 * it grows taller rather than clipping when names wrap.
 */
export function CategoryTile({
  name,
  vendorCount,
  nearYou = true,
  icon = 'storefront-outline',
  onPress,
  style,
}: CategoryTileProps) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const scale = Math.min(useFontScale('body'), 1.4);
  const title = localized(name);
  const count =
    vendorCount === undefined
      ? undefined
      : t(nearYou ? 'counts.nearYou' : 'counts.vendors', { count: vendorCount });

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={count ? `${title}, ${count}` : title}
      style={[styles.card, style]}
    >
      <View style={[styles.glyph, { width: 40 * scale, height: 40 * scale }]}>
        <Icon name={icon} size={Sizes.iconSmall * scale} color={Colors.primary} />
      </View>
      <View style={styles.text}>
        <AppText variant="body" weight={600}>
          {title}
        </AppText>
        {count && (
          <AppText variant="label" weight={400} color="text2">
            {count}
          </AppText>
        )}
      </View>
    </Card>
  );
}

const useStyles = makeStyles((Colors) => ({
  card: {
    minHeight: Sizes.tile,
    gap: Spacing.md,
    padding: Spacing.md + 2,
  },
  glyph: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.thumb,
    borderCurve: 'continuous',
    backgroundColor: Colors.primaryTint,
  },
  text: {
    gap: 2,
  },
}));
