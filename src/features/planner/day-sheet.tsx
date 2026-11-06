import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

import { BottomSheet } from '@/components/bottom-sheet';
import { Button } from '@/components/button';
import { Calendar } from '@/components/calendar';
import { useLocale } from '@/i18n/locale-context';
import { successHaptic } from '@/lib/haptics';

export type DaySheetProps = {
  /** What the day is for, already in words: "When's the Mehndi?". Open while set. */
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
 * The calendar for one event's day, in a sheet from the bottom. Tapping a
 * day picks it and closes, so it's one tap; the wedding's other days are
 * dotted on it.
 */
export function DaySheet({ title, value, marks, near, onPick, onClear, onClose }: DaySheetProps) {
  const { t } = useLocale();
  const reduceMotion = useReducedMotion();
  const closing = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => clearTimeout(closing.current ?? undefined), []);

  const pick = (date: string) => {
    successHaptic();
    onPick(date);
    // A moment to see the day fill in before the sheet goes
    closing.current = setTimeout(onClose, reduceMotion ? 0 : 220);
  };

  return (
    <BottomSheet title={title} onClose={onClose}>
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
    </BottomSheet>
  );
}
