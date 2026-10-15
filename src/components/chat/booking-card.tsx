import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { makeStyles, Radius, Spacing } from '@/constants/theme';
import type { ChatBooking } from '@/features/chat/chat-types';
import { formatDate } from '@/features/inquiry/inquiry-helpers';
import { useLocale } from '@/i18n/locale-context';

/**
 * The first message of every conversation: the family's inquiry as a card
 * (events, date, guests, where, and the venue or caterer answers), so both
 * sides always see what was asked without scrolling back through emails.
 */
export function BookingCard({
  booking,
  eventNames,
  guestLabel,
  answers = [],
  message,
}: {
  booking: ChatBooking;
  /** booking.eventSlugs as names in the app's language. */
  eventNames: string[];
  /** booking.guestBand as words ("100 to 250"). */
  guestLabel?: string | null;
  /** booking.details as labelled rows: each event's day, then the hall or caterer answers. */
  answers?: { label: string; value: string }[];
  /** What the family wrote with the request. */
  message?: string | null;
}) {
  const styles = useStyles();
  const { t } = useLocale();
  const notSure = t('chat.booking.notSure');
  const rows = [
    { label: t('chat.booking.events'), value: eventNames.join(', ') || notSure },
    {
      label: t('chat.booking.date'),
      value: booking.eventDate ? formatDate(booking.eventDate) : notSure,
    },
    { label: t('chat.booking.guests'), value: guestLabel || notSure },
    ...(booking.location ? [{ label: t('chat.booking.where'), value: booking.location }] : []),
    ...answers,
  ];

  return (
    <View style={styles.card}>
      <AppText variant="label" weight={600} color="primary">
        {t('chat.booking.title')}
      </AppText>
      {rows.map((row, i) => (
        <View key={`${row.label}-${i}`} style={[styles.row, i > 0 && styles.divided]}>
          <AppText color="text2">{row.label}</AppText>
          <AppText weight={600}>{row.value}</AppText>
        </View>
      ))}
      {message?.trim() ? (
        <View style={[styles.row, styles.divided]}>
          <AppText color="text2">{t('chat.booking.message')}</AppText>
          <AppText selectable>{message.trim()}</AppText>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  card: {
    gap: Spacing.xs,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  row: {
    gap: 2,
    paddingVertical: Spacing.sm,
  },
  divided: {
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
  },
}));
