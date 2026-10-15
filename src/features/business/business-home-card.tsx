import { router } from 'expo-router';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import { useBusinessLeads, useBusinessStats, waitingCount } from '@/data/business';
import { useLocale } from '@/i18n/locale-context';

import { useCurrentBusiness } from './use-current-business';

/**
 * My business at the top of Home, for vendor accounts only: the business,
 * this week in one line ("38 people saw your page · 4 asked"), and the
 * families waiting for a reply. The whole card opens My business. Families
 * never see it.
 */
export function BusinessHomeCard() {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const current = useCurrentBusiness();
  const stats = useBusinessStats(current.vendorId, 7);
  const leads = useBusinessLeads(current.vendorId);
  const business = current.business;
  if (!business) return null;

  const name = business.name;
  const week = stats.data?.current;
  const waiting = waitingCount(leads.data ?? []);
  const weekLine = week
    ? t('business.home.week', { count: week.views, asked: week.inquiries })
    : null;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={[
        t('business.title'),
        name,
        weekLine,
        waiting > 0 ? t('business.leads.waitingCount', { count: waiting }) : null,
      ]
        .filter(Boolean)
        .join('. ')}
      accessibilityHint={t('business.home.hint')}
      onPress={() => router.push('/business')}
      style={styles.card}
    >
      <View style={styles.top}>
        <View style={styles.badge}>
          <Icon name="storefront" size={Sizes.icon} color={Colors.onPrimary} />
        </View>
        <View style={styles.grow}>
          <AppText variant="label" weight={600} color="primary">
            {t('business.title')}
          </AppText>
          <AppText variant="heading" weight={700}>
            {name}
          </AppText>
        </View>
        <Icon name="chevron-forward" size={20} color={Colors.chevron} />
      </View>
      {weekLine && <AppText>{weekLine}</AppText>}
      {waiting > 0 && (
        <View style={styles.waiting}>
          <AppText weight={700} color="onPrimary">
            {t('business.leads.waitingCount', { count: waiting })}
          </AppText>
        </View>
      )}
    </PressableScale>
  );
}

const useStyles = makeStyles((Colors) => ({
  card: {
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryFill,
  },
  grow: {
    flex: 1,
  },
  waiting: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.chip,
    backgroundColor: Colors.primaryFill,
  },
}));
