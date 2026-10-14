import * as WebBrowser from 'expo-web-browser';
import { Platform, View, type ViewStyle } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Icon, type IconName } from '@/components/icon';
import { NavScreen } from '@/components/nav';
import { StateView } from '@/components/state-view';
import { makeStyles, Radius, Spacing, useColors } from '@/constants/theme';
import { SITE_URL_IS_PLACEHOLDER, siteLink } from '@/constants/links';
import { useCurrentBusiness } from '@/features/business/use-current-business';
import { useMockTogglePro, useProStatus } from '@/features/requests/requests-source';
import { useLocale } from '@/i18n/locale-context';

const PERKS: { icon: IconName; key: string }[] = [
  { icon: 'megaphone-outline', key: 'looking' },
  { icon: 'paper-plane-outline', key: 'proposals' },
  { icon: 'calendar-outline', key: 'calendar' },
  { icon: 'sparkles', key: 'badge' },
];

/**
 * Wedded Pro (#221): what a vendor gets for $50 a month, and Subscribe, which
 * opens the website (Pro is sold there through Stripe, not in the app). Your
 * listing, inquiries, chat and reels stay free either way.
 */
export default function ProScreen() {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const { business, vendorId, isPending } = useCurrentBusiness();
  const pro = useProStatus(vendorId);
  const toggle = useMockTogglePro();
  const image = `linear-gradient(160deg, ${Colors.heroFrom} 0%, ${Colors.heroTo} 100%)`;

  if (isPending || pro.isPending) return <StateView state="loading" />;
  const isPro = pro.data === 'pro';

  const subscribe = () => {
    if (!business) return;
    void WebBrowser.openBrowserAsync(siteLink(`/pro?vendor=${business.slug}`));
  };

  return (
    <NavScreen title={t('pro.title')} subtitle={t('pro.subtitle')}>
      <View
        style={[
          styles.hero,
          (Platform.OS === 'web'
            ? { backgroundImage: image }
            : { experimental_backgroundImage: image }) as unknown as ViewStyle,
        ]}
      >
        <Icon name="sparkles" size={30} color={Colors.onHero} />
        <AppText variant="display" color="onHero" serif>
          {t('pro.name')}
        </AppText>
        <View style={styles.priceRow}>
          <AppText color="onHero" style={styles.price} maxFontSizeMultiplier={1.4}>
            {t('pro.price')}
          </AppText>
          <AppText variant="bodyLg" color="onHero2">
            {t('pro.perMonth')}
          </AppText>
        </View>
        <AppText color="onHero2">{t('pro.cancelAnytime')}</AppText>
      </View>

      <View style={styles.perks}>
        {PERKS.map((perk) => (
          <View key={perk.key} style={styles.perk}>
            <View style={styles.perkIcon}>
              <Icon name={perk.icon} size={22} color={Colors.primary} />
            </View>
            <View style={styles.grow}>
              <AppText weight={700}>{t(`pro.perks.${perk.key}.title`)}</AppText>
              <AppText color="text2">{t(`pro.perks.${perk.key}.body`)}</AppText>
            </View>
          </View>
        ))}
      </View>

      {isPro ? (
        <View style={styles.on}>
          <Icon name="checkmark-circle" size={24} color={Colors.success} />
          <AppText weight={700} color="success" style={styles.grow}>
            {t('pro.youreOn')}
          </AppText>
        </View>
      ) : (
        <Button label={t('pro.subscribe')} onPress={subscribe} />
      )}
      <AppText variant="label" weight={400} color="text2">
        {SITE_URL_IS_PLACEHOLDER ? t('pro.soon') : t('pro.onWebsite')}
      </AppText>
      <AppText variant="label" weight={400} color="text2">
        {t('pro.free')}
      </AppText>
      {/* Mock only, while the screens run on sample data */}
      <Button
        variant="text"
        label={isPro ? 'Preview: turn Pro off' : 'Preview: turn Pro on'}
        onPress={toggle}
      />
    </NavScreen>
  );
}

const useStyles = makeStyles((Colors) => ({
  hero: {
    gap: Spacing.sm,
    padding: Spacing.xl,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.heroFrom,
    overflow: 'hidden',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  price: {
    fontSize: 48,
    lineHeight: 56,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  perks: {
    gap: Spacing.lg,
  },
  perk: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'flex-start',
  },
  perkIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryTint,
  },
  on: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 48,
  },
  grow: {
    flex: 1,
  },
}));
