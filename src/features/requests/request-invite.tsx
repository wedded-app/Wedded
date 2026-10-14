import type { ReactNode } from 'react';
import { Platform, View, type ViewStyle } from 'react-native';

import { AppText } from '@/components/app-text';
import { makeStyles, Radius, Spacing } from '@/constants/theme';
import { daysUntil } from '@/features/planner/plan-helpers';
import { useLocale } from '@/i18n/locale-context';

import { DateTile } from './night';
import type { PostFacts } from './request-parts';

/**
 * A request drawn like a small invitation (#219): a gold line across the top,
 * the date as a calendar page, the event in gold capitals, the headline in
 * the serif, "241 days away", the guests and budget, then `footer` (the
 * proposals, or a status). Readable at any text size: it stacks when there's
 * no room.
 */
export function RequestInvite({
  eventName,
  headline,
  date,
  facts,
  note,
  footer,
}: {
  eventName?: string | null;
  headline: string;
  date: string | null;
  facts: PostFacts;
  note?: string | null;
  footer?: ReactNode;
}) {
  const styles = useStyles();
  const { t } = useLocale();
  const days = date ? daysUntil(date) : null;
  const details = [facts.guests, facts.budget].filter(Boolean).join(' · ');

  return (
    <View style={styles.card}>
      <View style={styles.band} />
      <View style={styles.row}>
        {date ? <DateTile date={date} size="lg" /> : null}
        <View style={styles.words}>
          {eventName ? (
            <AppText variant="label" weight={700} color="champagne">
              {eventName.toUpperCase()}
            </AppText>
          ) : null}
          <AppText variant="title" serif weight={600}>
            {headline}
          </AppText>
          {days !== null && days >= 0 ? (
            <AppText weight={600} color="text2">
              {days === 0 ? t('requests.invite.today') : t('requests.invite.away', { count: days })}
            </AppText>
          ) : null}
        </View>
      </View>
      {details ? <AppText color="text2">{details}</AppText> : null}
      {note ? (
        <AppText style={styles.note} numberOfLines={4}>
          {`“${note}”`}
        </AppText>
      ) : null}
      {footer}
    </View>
  );
}

const gold = (css: string) =>
  (Platform.OS === 'web'
    ? { backgroundImage: css }
    : { experimental_backgroundImage: css }) as unknown as ViewStyle;

const useStyles = makeStyles((Colors) => ({
  card: {
    gap: Spacing.md,
    padding: Spacing.xl,
    paddingTop: Spacing.xl + 4,
    borderRadius: Radius.card + 4,
    borderCurve: 'continuous',
    backgroundColor: Colors.nightCardStrong,
    borderWidth: 1,
    borderColor: Colors.nightLine,
    overflow: 'hidden',
  },
  band: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    ...gold(
      `linear-gradient(90deg, rgba(233,201,139,0) 0%, ${Colors.champagne} 50%, rgba(233,201,139,0) 100%)`,
    ),
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  words: {
    flex: 1,
    minWidth: 180,
    gap: Spacing.xs,
  },
  note: {
    fontStyle: 'italic',
  },
}));
