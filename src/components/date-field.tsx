import DateTimePicker from '@react-native-community/datetimepicker';
import { createElement, useState } from 'react';
import { Platform, View } from 'react-native';

import { Button } from '@/components/button';
import { makeStyles, Radius, Spacing, useColors, useScheme } from '@/constants/theme';
import { formatDate, fromDateString, toDateString } from '@/features/inquiry/inquiry-helpers';
import { formatTime } from '@/features/vendors/profile-format';
import { useLocale } from '@/i18n/locale-context';

export type DateFieldProps = {
  /** yyyy-mm-dd (HH:MM for a time), or null when not picked yet. */
  value: string | null;
  onChange: (value: string) => void;
  /** Shown on the button before a date is picked. */
  placeholder: string;
  /** Pick a time of day instead, e.g. when an event starts. */
  mode?: 'date' | 'time';
};

/** "19:30" as today at 7:30 PM, for the time wheel. */
function fromTimeString(value: string): Date {
  const [hours, minutes] = value.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function toTimeString(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * Picking a date (or a time): the phone's own wheel (iOS) or calendar and
 * clock (Android) under a button showing it, and the browser's date or time
 * box on the web, where the phone picker isn't available.
 */
export function DateField({ value, onChange, placeholder, mode = 'date' }: DateFieldProps) {
  const Colors = useColors();
  const styles = useStyles();
  const scheme = useScheme();
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const isTime = mode === 'time';

  if (Platform.OS === 'web') {
    return createElement('input', {
      type: mode,
      value: value ?? '',
      min: isTime ? undefined : toDateString(new Date()),
      'aria-label': placeholder,
      onChange: (event: { target: { value: string } }) => {
        if (event.target.value) onChange(event.target.value);
      },
      style: {
        minHeight: 52,
        padding: '0 16px',
        borderRadius: Radius.field,
        border: `1px solid ${Colors.borderInput}`,
        background: Colors.surface,
        color: Colors.text,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif",
        fontSize: 17,
        colorScheme: scheme,
      },
    });
  }

  return (
    <View style={styles.field}>
      <Button
        variant="secondary"
        icon={isTime ? 'time-outline' : 'calendar-outline'}
        label={value ? (isTime ? formatTime(value) : formatDate(value)) : placeholder}
        onPress={() => setOpen((shown) => !shown)}
      />
      {open && (
        <DateTimePicker
          value={value ? (isTime ? fromTimeString(value) : fromDateString(value)) : new Date()}
          mode={mode}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={isTime ? undefined : new Date()}
          themeVariant={scheme}
          onChange={(event, picked) => {
            if (Platform.OS !== 'ios') setOpen(false);
            if (event.type === 'set' && picked) {
              onChange(isTime ? toTimeString(picked) : toDateString(picked));
            }
          }}
        />
      )}
      {open && Platform.OS === 'ios' && (
        <Button variant="text" label={t('location.done')} onPress={() => setOpen(false)} />
      )}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  field: {
    gap: Spacing.sm,
  },
}));
