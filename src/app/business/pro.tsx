import * as WebBrowser from 'expo-web-browser';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Icon, type IconName } from '@/components/icon';
import { StateView } from '@/components/state-view';
import { SITE_URL_IS_PLACEHOLDER, siteLink } from '@/constants/links';
import { makeStyles, SchemeContext, Spacing, useColors } from '@/constants/theme';
import { useProStatus } from '@/data/requests';
import { useCurrentBusiness } from '@/features/business/use-current-business';
import { formatDate } from '@/features/inquiry/inquiry-helpers';
import { GlassCard, GlowButton, NightScreen } from '@/features/requests/night';
import { useLocale } from '@/i18n/locale-context';

const PERKS: { icon: IconName; key: string }[] = [
  { icon: 'megaphone-outline', key: 'looking' },
  { icon: 'paper-plane-outline', key: 'proposals' },
  { icon: 'calendar-outline', key: 'calendar' },
  { icon: 'sparkles', key: 'badge' },
];

/**
 * Wedded Pro (#221), on the night page: "Families come to you." in the
 * serif, $50 a month large in gold, what you get as glowing rows, and
 * Subscribe, which opens the website (Pro is sold there, not in the app).
 * Pro vendors see when it renews or ends, or a gentle note when the card
 * failed, and Manage or cancel, one tap like Subscribe. Listings, inquiries, chat and reels stay free either way.
 */
export default function ProScreen() {
  return (
    <SchemeContext.Provider value="dark">
      <Pro />
    </SchemeContext.Provider>
  );
}

function Pro() {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const { business, vendorId, isPending } = useCurrentBusiness();
  const pro = useProStatus(vendorId);

  if (isPending || pro.isPending) {
    return (
      <NightScreen>
        <StateView state="loading" />
      </NightScreen>
    );
  }
  const isPro = pro.data?.plan === 'pro';
  const renews = pro.data?.renewsOn ? formatDate(pro.data.renewsOn.slice(0, 10)) : null;

  const openWebsite = () => {
    if (!business) return;
    void WebBrowser.openBrowserAsync(siteLink(`/pro?vendor=${business.slug}`));
  };

  return (
    <NightScreen
      eyebrow={t('pro.eyebrow')}
      title={t('pro.subtitle')}
      footer={
        <View style={styles.footer}>
          {isPro ? (
            // Leaving is as easy as joining: the same one tap, the same website.
            <GlowButton
              glass={!pro.data?.pastDue}
              icon={pro.data?.pastDue ? 'card-outline' : 'settings-outline'}
              label={t(pro.data?.pastDue ? 'pro.updateCard' : 'pro.manage')}
              onPress={openWebsite}
            />
          ) : (
            <GlowButton icon="sparkles" label={t('pro.subscribe')} onPress={openWebsite} />
          )}
          <AppText variant="label" weight={400} color="text2" style={styles.center}>
            {isPro
              ? t('pro.manageOnWebsite')
              : SITE_URL_IS_PLACEHOLDER
                ? t('pro.soon')
                : t('pro.onWebsite')}
          </AppText>
        </View>
      }
    >
      <View>
        <View style={styles.price}>
          <AppText serif weight={600} style={styles.amount} maxFontSizeMultiplier={1.3}>
            {t('pro.price')}
          </AppText>
          <AppText variant="title" weight={600}>
            {t('pro.perMonth')}
          </AppText>
        </View>
        <AppText color="text2">{t('pro.cancelAnytime')}</AppText>
      </View>

      {isPro && (
        <GlassCard strong style={styles.on}>
          <Icon name="checkmark-circle" size={28} color={Colors.success} />
          <View style={styles.grow}>
            <AppText weight={700}>{t('pro.youreOn')}</AppText>
            {pro.data?.pastDue ? (
              <AppText color="error">{t('pro.pastDue')}</AppText>
            ) : renews ? (
              <AppText color="text2">
                {t(pro.data?.cancelAtPeriodEnd ? 'pro.ends' : 'pro.renews', { date: renews })}
              </AppText>
            ) : null}
          </View>
        </GlassCard>
      )}

      <View style={styles.perks}>
        {PERKS.map((perk, i) => (
          <Animated.View key={perk.key} entering={FadeInDown.delay(120 + i * 90).duration(380)}>
            <GlassCard style={styles.perk}>
              <View style={styles.orb}>
                <Icon name={perk.icon} size={24} color={Colors.champagne} />
              </View>
              <View style={styles.grow}>
                <AppText variant="heading" weight={700}>
                  {t(`pro.perks.${perk.key}.title`)}
                </AppText>
                <AppText color="text2">{t(`pro.perks.${perk.key}.body`)}</AppText>
              </View>
            </GlassCard>
          </Animated.View>
        ))}
      </View>

      <AppText color="text2" style={styles.center}>
        {t('pro.free')}
      </AppText>
    </NightScreen>
  );
}

const useStyles = makeStyles((Colors) => ({
  grow: {
    flex: 1,
  },
  center: {
    textAlign: 'center',
  },
  footer: {
    gap: Spacing.sm,
  },
  price: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    columnGap: Spacing.md,
  },
  amount: {
    fontSize: 88,
    lineHeight: 100,
    color: Colors.champagne,
    fontVariant: ['tabular-nums'],
  },
  on: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  perks: {
    gap: Spacing.md,
  },
  perk: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  orb: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.nightCardStrong,
    borderWidth: 1,
    borderColor: Colors.nightLine,
    boxShadow: '0px 0px 22px rgba(233, 201, 139, 0.22)',
  },
}));
