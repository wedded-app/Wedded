import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, SlideInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Calendar } from '@/components/calendar';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { makeStyles, Radius, Sizes, Spacing, Timing, useColors } from '@/constants/theme';
import { useLocale } from '@/i18n/locale-context';
import { successHaptic } from '@/lib/haptics';
import { iosEasing } from '@/lib/motion';

export type DaySheetProps = {
  /** What the day is for, already in words: "When's the Mehndi?". */
  title: string | null;
  value: string | null;
  /** The family's other days, with what's on each. */
  marks: Record<string, string[]>;
  /** The month to open on when there's no day yet. */
  near: string | null;
  onPick: (date: string) => void;
  onClear: () => void;
  onClose: () => void;
};

/**
 * The calendar for one event's day, sliding up from the bottom over a dim
 * page. Tapping a day picks it and closes, so it's one tap; the other days
 * of the wedding are dotted on it. Open while `title` is set.
 */
export function DaySheet({ title, value, marks, near, onPick, onClear, onClose }: DaySheetProps) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const closing = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => clearTimeout(closing.current ?? undefined), []);
  // Keeps its words while it fades out after closing
  const [shownTitle, setShownTitle] = useState(title);
  if (title !== null && title !== shownTitle) setShownTitle(title);

  const pick = (date: string) => {
    successHaptic();
    onPick(date);
    // A moment to see the day fill in before the sheet goes
    closing.current = setTimeout(onClose, reduceMotion ? 0 : 220);
  };

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
          <Calendar value={value} onChange={pick} marks={marks} near={near} />
          {value && (
            <Button
              variant="text"
              label={t('planner.days.clear')}
              onPress={() => {
                onClear();
                onClose();
              }}
            />
          )}
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
