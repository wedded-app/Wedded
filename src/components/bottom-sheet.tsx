import { useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, SlideInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { makeStyles, Radius, Sizes, Spacing, Timing, useColors } from '@/constants/theme';
import { useLocale } from '@/i18n/locale-context';
import { iosEasing } from '@/lib/motion';

/**
 * A small sheet that slides up from the bottom over a dim page, for one
 * quick choice made in place (an event's day, about how many guests): a
 * grabber, a title with a round Close, then what's passed in. Tapping the
 * dim page or Close closes it. Open while `title` is set; it keeps its last
 * title while it fades out.
 */
export function BottomSheet({
  title,
  onClose,
  children,
}: {
  title: string | null;
  onClose: () => void;
  children: ReactNode;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [shownTitle, setShownTitle] = useState(title);
  if (title !== null && title !== shownTitle) setShownTitle(title);

  return (
    <Modal
      visible={title !== null}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={onClose}
          style={[StyleSheet.absoluteFill, styles.dim]}
        />
        <Animated.View
          entering={reduceMotion ? FadeIn : SlideInDown.duration(Timing.page).easing(iosEasing)}
          style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.lg }]}
          accessibilityViewIsModal
        >
          <View style={styles.grabber} />
          <View style={styles.head}>
            <AppText variant="section" accessibilityRole="header" style={styles.grow}>
              {shownTitle}
            </AppText>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              pressedScale={0.9}
              hitSlop={4}
              onPress={onClose}
              style={styles.close}
            >
              <Icon name="close" size={20} color={Colors.text} weight="semibold" />
            </PressableScale>
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((Colors) => ({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  dim: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sheet: {
    gap: Spacing.md,
    paddingHorizontal: Sizes.pageGutter,
    paddingTop: Spacing.sm,
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    borderCurve: 'continuous',
    backgroundColor: Colors.bg,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.separator,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingTop: Spacing.xs,
  },
  grow: {
    flex: 1,
  },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
}));
