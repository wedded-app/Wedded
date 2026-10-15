import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { GlassButton } from '@/components/glass-button';
import { Sizes, Spacing } from '@/constants/theme';
import { useLocale } from '@/i18n/locale-context';

export type SheetHeaderProps = {
  onClose: () => void;
  /** Screen reader label for the close button; "Close" by default. */
  closeLabel?: string;
  /** A small centred title, for sheets whose big title is in the content. */
  title?: string;
  /** Another glass button on the left, e.g. Back inside a multi-step sheet. */
  leading?: ReactNode;
};

/**
 * The top of a sheet (a modal screen), iOS 26 style: a round glass close
 * button on the right and an optional small title between.
 */
export function SheetHeader({ onClose, closeLabel, title, leading }: SheetHeaderProps) {
  const { t } = useLocale();

  return (
    <View style={styles.bar}>
      <View style={styles.side}>{leading}</View>
      <View style={styles.titleWrap}>
        {title ? (
          <AppText
            variant="button"
            numberOfLines={1}
            maxFontSizeMultiplier={1.3}
            accessibilityRole="header"
          >
            {title}
          </AppText>
        ) : null}
      </View>
      <View style={[styles.side, styles.end]}>
        <GlassButton
          icon="close"
          color="#000000"
          accessibilityLabel={closeLabel ?? t('signIn.close')}
          onPress={onClose}
          size={44}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: Sizes.navBar,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  side: {
    width: 88,
    flexDirection: 'row',
  },
  end: {
    justifyContent: 'flex-end',
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
  },
});
