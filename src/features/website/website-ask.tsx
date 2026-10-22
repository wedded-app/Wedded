import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Chip } from '@/components/chip';
import { Icon } from '@/components/icon';
import { makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import type { SitePage } from '@/data/website';
import { WedMark } from '@/features/wed/wed-mark';
import { useLocale } from '@/i18n/locale-context';

/** What Wed offers first, as one tap each. */
export const WED_SUGGESTIONS = [
  'website.wed.suggest.setUp',
  'website.wed.suggest.look',
  'website.wed.suggest.dress',
  'website.wed.suggest.missing',
] as const;

/**
 * The way into Wed on the Website screen: a box that reads like a message
 * field ("Ask Wed to change anything") and a row of things to ask, each one
 * tap. Opens Wed's sheet, which shows any change before making it.
 */
export function WebsiteAsk({ site }: { site: SitePage; weddingId: string }) {
  const styles = useStyles();
  const Colors = useColors();
  const { t } = useLocale();
  const open = (ask?: string) =>
    router.push(ask ? { pathname: '/website/wed', params: { ask } } : '/website/wed');

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('website.wed.box')}
        onPress={() => open()}
        style={({ pressed }) => [styles.box, pressed && styles.pressed]}
      >
        <WedMark size={24} color="ombre" />
        <AppText color="text2" style={styles.grow}>
          {t('website.wed.box')}
        </AppText>
        <Icon name="arrow-up-circle" size={28} color={Colors.text} />
      </Pressable>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {WED_SUGGESTIONS.map((key) => (
          <Chip key={key} role="button" label={t(key)} onPress={() => open(t(key))} />
        ))}
      </ScrollView>
      <AppText variant="caption" color="text2" style={styles.note}>
        {site.publishedAt ? t('website.wed.noteLive') : t('website.wed.note')}
      </AppText>
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  card: {
    gap: Spacing.md,
    paddingVertical: Spacing.lg,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: Sizes.input,
    marginHorizontal: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.button,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pressed: {
    opacity: 0.8,
  },
  grow: {
    flex: 1,
  },
  chips: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  note: {
    paddingHorizontal: Spacing.lg,
  },
}));
