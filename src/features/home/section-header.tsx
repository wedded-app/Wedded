import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { SectionTitle } from '@/components/list';
import { Spacing } from '@/constants/theme';

/** A Home section's title with an optional link on the right ("See all"). */
export function SectionHeader({
  title,
  link,
  onLink,
}: {
  title: string;
  link?: string;
  onLink?: () => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.title}>
        <SectionTitle>{title}</SectionTitle>
      </View>
      {link && onLink && (
        <Pressable
          accessibilityRole="link"
          onPress={onLink}
          hitSlop={12}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <AppText weight={600} color="primary">
            {link}
          </AppText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingRight: Spacing.xs,
  },
  title: {
    flexShrink: 1,
  },
  pressed: {
    opacity: 0.5,
  },
});
