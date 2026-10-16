import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { DietChips } from '@/components/diet-chips';
import { makeStyles, Radius, Spacing } from '@/constants/theme';
import { menuMinimum, menuPrice } from '@/features/menus/menu-format';
import type { Menu } from '@/features/menus/menu-types';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

/**
 * A whole menu for its sheet: name, price, minimum, description and diet tags,
 * then each section ("Starters", "Mains") as a white group of items with their
 * own diet tags. Put it in a ScrollView.
 */
export function MenuDetails({ menu }: { menu: Menu }) {
  const styles = useStyles();
  const { t } = useLocale();
  const description = menu.description?.en.trim() || null;
  const facts = [menuPrice(menu, t), menuMinimum(menu, t), menu.cuisine].filter(Boolean);

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <AppText variant="title" accessibilityRole="header">
          {localized(menu.name)}
        </AppText>
        {facts.length > 0 && (
          <AppText weight={600} color="primary">
            {facts.join(' · ')}
          </AppText>
        )}
        {description && <AppText color="text2">{description}</AppText>}
        <DietChips tags={menu.dietTags} />
      </View>

      {menu.sections.map((section, s) => (
        <View key={s} style={styles.section}>
          <AppText variant="section" accessibilityRole="header">
            {localized(section.name)}
          </AppText>
          <View style={styles.group}>
            {section.items.map((item, i) => (
              <View key={i} style={[styles.item, i > 0 && styles.divided]}>
                <AppText weight={600}>{localized(item.name)}</AppText>
                {item.description && (
                  <AppText variant="label" weight={400} color="text2">
                    {item.description}
                  </AppText>
                )}
                <DietChips tags={item.dietTags} small />
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  wrap: {
    gap: Spacing.xl,
  },
  head: {
    gap: Spacing.sm,
  },
  section: {
    gap: Spacing.sm,
  },
  group: {
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  item: {
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  divided: {
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
  },
}));
