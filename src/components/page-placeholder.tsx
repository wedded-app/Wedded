import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { makeStyles, Radius, Sizes, Spacing } from '@/constants/theme';
import { useLocale } from '@/i18n/locale-context';

/**
 * Grey blocks shaped like a page (a card, then two titled shelves) while its
 * content loads, so the page never sits blank. Still, so there is nothing for
 * Reduce Motion to turn off. `screen` fills the screen under the status bar,
 * for the moment before the tabs know where to go.
 */
export function PagePlaceholder({ screen = false }: { screen?: boolean }) {
  const styles = useStyles();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('states.loading')}
      accessibilityState={{ busy: true }}
      style={[styles.blocks, screen && [styles.screen, { paddingTop: insets.top + Spacing.xxl }]]}
    >
      <View style={[styles.block, styles.card]} />
      <View style={[styles.block, styles.line]} />
      <View style={[styles.block, styles.shelf]} />
      <View style={[styles.block, styles.line]} />
      <View style={[styles.block, styles.shelf]} />
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  blocks: {
    gap: Spacing.lg,
  },
  screen: {
    flex: 1,
    paddingHorizontal: Sizes.pageGutter,
    backgroundColor: Colors.canvas,
  },
  block: {
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.fill,
  },
  card: {
    height: 160,
  },
  line: {
    width: '45%',
    height: 20,
    marginTop: Spacing.sm,
  },
  shelf: {
    height: 120,
  },
}));
