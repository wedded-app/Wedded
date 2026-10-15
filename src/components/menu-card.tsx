import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { DietChips } from '@/components/diet-chips';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import { menuMinimum, menuPrice } from '@/features/menus/menu-format';
import type { Menu } from '@/features/menus/menu-types';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

/**
 * One menu as a card: its name, the price per guest, the minimum, the cuisine
 * and diet tags, and "See the full menu". Used on the vendor profile and as a
 * menu message in chat. The whole card is one button.
 */
export function MenuCard({ menu, onPress }: { menu: Menu; onPress?: () => void }) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const name = localized(menu.name);
  const price = menuPrice(menu, t);
  const minimum = menuMinimum(menu, t);
  const details = [price, minimum, menu.cuisine].filter(Boolean).join(' · ');

  const body = (
    <>
      <View style={styles.top}>
        <View style={styles.text}>
          <AppText variant="heading" weight={700}>
            {name}
          </AppText>
          {price && (
            <AppText weight={600} color="primary" style={styles.tabular}>
              {price}
            </AppText>
          )}
          {(minimum || menu.cuisine) && (
            <AppText variant="label" weight={400} color="text2">
              {[minimum, menu.cuisine].filter(Boolean).join(' · ')}
            </AppText>
          )}
        </View>
        <View style={styles.badge}>
          <Icon name="restaurant-outline" size={Sizes.iconSmall} color={Colors.primary} />
        </View>
      </View>
      <DietChips tags={menu.dietTags} small />
      {onPress && (
        <View style={styles.more}>
          <AppText weight={600} color="primary">
            {t('menus.seeMenu')}
          </AppText>
          <Icon name="chevron-forward" size={16} color={Colors.primary} weight="semibold" />
        </View>
      )}
    </>
  );

  if (!onPress) return <View style={styles.card}>{body}</View>;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={t('menus.cardLabel', { name, details })}
      onPress={onPress}
      style={styles.card}
    >
      {body}
    </PressableScale>
  );
}

const useStyles = makeStyles((Colors) => ({
  card: {
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  top: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  badge: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.thumb,
    backgroundColor: Colors.primaryTint,
  },
  more: {
    minHeight: Sizes.tapTarget - 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
}));
