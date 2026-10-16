import { useRouter } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { groupIcon } from '@/components/group-icon';
import { Icon } from '@/components/icon';
import { makeStyles, Sizes, Spacing, useColors } from '@/constants/theme';
import type { CategoryGroup } from '@/data/reference';
import { localized } from '@/i18n/localized';

const CIRCLE = 60;

/**
 * "What do you need?" on Home: the kinds of vendor as one quiet row of round
 * icons with their names, swiped sideways, instead of a wall of photo tiles.
 * Each opens that kind's page.
 */
export function VendorTypeRow({ groups }: { groups: CategoryGroup[] }) {
  const Colors = useColors();
  const styles = useStyles();
  const router = useRouter();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.track}
    >
      {groups.map((group) => {
        const name = localized(group.name);
        return (
          <Pressable
            key={group.slug}
            accessibilityRole="button"
            accessibilityLabel={name}
            onPress={() => router.push({ pathname: '/g/[group]', params: { group: group.slug } })}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}
          >
            <View style={styles.circle}>
              <Icon name={groupIcon(group.slug)} size={26} color={Colors.primary} />
            </View>
            <AppText
              variant="label"
              weight={600}
              numberOfLines={2}
              maxFontSizeMultiplier={1.3}
              style={styles.name}
            >
              {name}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const useStyles = makeStyles((Colors) => ({
  scroll: {
    marginHorizontal: -Sizes.pageGutter,
  },
  track: {
    gap: Spacing.sm,
    paddingHorizontal: Sizes.pageGutter,
  },
  item: {
    width: 84,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  pressed: {
    opacity: 0.6,
  },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryTint,
  },
  name: {
    textAlign: 'center',
  },
}));
