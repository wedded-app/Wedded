import { Platform, Pressable, View, type ViewStyle } from 'react-native';

import { AppText, useFontScale } from '@/components/app-text';
import { Glass } from '@/components/glass';
import { Icon } from '@/components/icon';
import { makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';

import { openWed } from './open-wed';
import type { WedContext } from './wed-store';
import { WedMark } from './wed-mark';

export type AskWedButtonProps = {
  /**
   * pill: a grey capsule with the mark and the label ("Ask Wed about this
   * vendor"), full width. round: a 48 glass circle with the mark, for a nav
   * bar. row: a 60 row with the mark, the label and a chevron, inside a
   * card. rail: the white mark and "Wed" on the Reels rail, over the video.
   * Monochrome but for round: maroon stays on the few things that send.
   */
  variant: 'pill' | 'round' | 'row' | 'rail';
  /** The words on pill and row ("Wed" on rail; round has none). */
  label?: string;
  /** The chip in the composer: what this is about. */
  about?: WedContext;
  /** Words for the composer. They wait there; nothing is sent. */
  ask: string;
  /** What a screen reader says; the label by default ("Ask Wed" for round). */
  a11y?: string;
};

/**
 * The way into Wed from anywhere in the app (a vendor page, a reel, My
 * Wedding, Search): opens the Wed chat with the question already in the
 * composer and what it's about in a chip above it (openWed). It never
 * sends; the family taps Send.
 */
export function AskWedButton({ variant, label, about, ask, a11y }: AskWedButtonProps) {
  const Colors = useColors();
  const styles = useStyles();
  const scale = useFontScale('body');
  const open = () => openWed({ about, ask });

  if (variant === 'round') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={a11y ?? label ?? 'Ask Wed'}
        onPress={open}
        hitSlop={4}
      >
        {({ pressed }) => (
          <Glass interactive style={[styles.round, pressed && styles.shrink]}>
            <WedMark size={22} color="primary" />
          </Glass>
        )}
      </Pressable>
    );
  }

  if (variant === 'rail') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={a11y ?? 'Ask Wed about this reel'}
        onPress={open}
        hitSlop={6}
        style={({ pressed }) => [styles.rail, pressed && styles.dim]}
      >
        <View style={styles.railMark}>
          <WedMark size={32} color="onPhoto" />
        </View>
        <AppText variant="caption" weight={700} style={[styles.onVideo, { color: Colors.onPhoto }]}>
          {label ?? 'Wed'}
        </AppText>
      </Pressable>
    );
  }

  if (variant === 'row') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={a11y ?? label}
        onPress={open}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      >
        <View style={[styles.rowMark, { width: Sizes.rowIcon * Math.min(scale, 1.4) }]}>
          <WedMark size={20} />
        </View>
        <AppText weight={600} style={styles.grow}>
          {label}
        </AppText>
        <Icon
          name="chevron-forward"
          size={17 * Math.min(scale, 1.4)}
          color={Colors.chevron}
          weight="semibold"
        />
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      onPress={open}
      style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
    >
      <WedMark size={Math.round(20 * Math.min(scale, 1.4))} />
      <AppText variant="button" style={styles.pillLabel}>
        {label}
      </AppText>
    </Pressable>
  );
}

// The rail's other icons are white glyphs with a soft shadow over the video.
// iOS shadows a transparent view by its content; Android and the web filter.
const glyphShadow: ViewStyle =
  Platform.OS === 'ios'
    ? {
        shadowColor: '#000000',
        shadowOpacity: 0.45,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 1 },
      }
    : { filter: 'drop-shadow(0px 1px 3px rgba(0, 0, 0, 0.45))' };

const useStyles = makeStyles((Colors) => ({
  round: {
    width: Sizes.glassButton,
    height: Sizes.glassButton,
    borderRadius: Sizes.glassButton / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shrink: {
    transform: [{ scale: 0.94 }],
  },
  rail: {
    minWidth: Sizes.tapTarget,
    minHeight: Sizes.tapTarget,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  railMark: {
    height: 32,
    justifyContent: 'center',
    ...glyphShadow,
  },
  onVideo: {
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  dim: {
    opacity: 0.6,
  },
  row: {
    minHeight: Sizes.row,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  rowPressed: {
    opacity: 0.55,
  },
  rowMark: {
    alignItems: 'center',
  },
  grow: {
    flex: 1,
  },
  pill: {
    minHeight: Sizes.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.button,
    backgroundColor: Colors.fill,
  },
  pillPressed: {
    backgroundColor: Colors.fillPressed,
  },
  pillLabel: {
    flexShrink: 1,
    textAlign: 'center',
  },
}));
