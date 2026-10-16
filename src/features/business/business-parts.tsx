import { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { ListRow, ListSection } from '@/components/list';
import { Icon } from '@/components/icon';
import { makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import type { Lead } from '@/data/business';
import { useTraditions } from '@/data/reference';
import { inboxTime } from '@/features/chat/chat-format';
import { formatDate } from '@/features/inquiry/inquiry-helpers';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

/** Every event's name in the app's language, from any tradition (a lead can be from any). */
export function useEventNames(): (slug: string) => string {
  const traditions = useTraditions();
  return useMemo(() => {
    const names = new Map<string, string>();
    for (const tradition of traditions.data ?? []) {
      for (const event of tradition.events) {
        if (!names.has(event.slug)) names.set(event.slug, localized(event.name));
      }
    }
    return (slug: string) => names.get(slug) ?? slug;
  }, [traditions.data]);
}

/**
 * The business's numbers as one quiet list: what each means in plain words,
 * how it moved from the period before as a grey line under it, and the
 * number on the right. Replaces a grid of big number cards.
 */
export function StatRows({
  rows,
}: {
  rows: {
    key: string;
    label: string;
    value: number;
    /** "Up 20% from the 30 days before", or null to say nothing. */
    changeWords: string | null;
  }[];
}) {
  return (
    <ListSection>
      {rows.map((row) => (
        <ListRow
          key={row.key}
          title={row.label}
          subtitle={row.changeWords ?? undefined}
          accessibilityLabel={[`${row.value} ${row.label}`, row.changeWords]
            .filter(Boolean)
            .join('. ')}
          trailing={
            <AppText variant="heading" weight={700}>
              {row.value.toLocaleString('en-US')}
            </AppText>
          }
        />
      ))}
    </ListSection>
  );
}

/**
 * One family's request in a list: who, a "Waiting for your reply" badge until
 * the vendor has written back, the events, date and guests, and when it came.
 */
export function LeadRow({ lead, onPress }: { lead: Lead; onPress: () => void }) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const eventName = useEventNames();
  const who = lead.familyName ?? t('chat.aFamily');
  const what = [
    lead.eventSlugs.map(eventName).join(', ') ||
      (lead.kind === 'tour' ? t('business.leads.tour') : null),
    lead.eventDate ? formatDate(lead.eventDate) : t('business.leads.dateNotSure'),
    t('business.leads.guests', { band: t(`inquiry.guestBands.${lead.guestBand}`) }),
  ]
    .filter(Boolean)
    .join(' · ');
  const when = inboxTime(lead.createdAt, t);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[
        who,
        lead.replied ? null : t('business.leads.waiting'),
        lead.kind === 'tour' ? t('business.leads.tour') : null,
        what,
        when,
      ]
        .filter(Boolean)
        .join(', ')}
      onPress={onPress}
      style={({ pressed }) => [styles.lead, pressed && styles.pressed]}
    >
      <View style={styles.leadText}>
        <View style={styles.leadTop}>
          <AppText variant="bodyLg" weight={700} style={styles.grow}>
            {who}
          </AppText>
          <AppText variant="label" weight={400} color="text2">
            {when}
          </AppText>
        </View>
        {(!lead.replied || lead.kind === 'tour') && (
          <View style={styles.badges}>
            {!lead.replied && (
              <View style={styles.waiting}>
                <AppText variant="caption" weight={700} color="onPrimary">
                  {t('business.leads.waiting')}
                </AppText>
              </View>
            )}
            {lead.kind === 'tour' && (
              <View style={styles.tour}>
                <AppText variant="caption" weight={700} color="kesari">
                  {t('business.leads.tour')}
                </AppText>
              </View>
            )}
          </View>
        )}
        <AppText color="text2">{what}</AppText>
      </View>
      <Icon name="chevron-forward" size={18} color={Colors.chevron} />
    </Pressable>
  );
}

/** "Your page isn't live yet": on Today and the Business tab until a founder publishes it. */
export function NotLiveNotice() {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  return (
    <View style={styles.notice}>
      <Icon name="eye-off-outline" size={22} color={Colors.kesari} />
      <AppText style={styles.grow}>{t('business.notLive')}</AppText>
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  lead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: Sizes.tapTarget,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  pressed: {
    opacity: 0.6,
  },
  leadText: {
    flex: 1,
    gap: Spacing.xs,
  },
  leadTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
  },
  grow: {
    flex: 1,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  waiting: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.chip,
    backgroundColor: Colors.primaryFill,
  },
  tour: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.chip,
    backgroundColor: Colors.kesariTint,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    backgroundColor: Colors.kesariTint,
  },
}));
