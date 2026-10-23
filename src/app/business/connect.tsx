import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Icon, type IconName } from '@/components/icon';
import { NavScreen } from '@/components/nav';
import { SITE_URL_IS_PLACEHOLDER } from '@/constants/links';
import { makeStyles, Radius, Spacing, useColors } from '@/constants/theme';
import { useMyListing } from '@/data/listing';
import { useCurrentBusiness } from '@/features/business/use-current-business';
import { shareVendor } from '@/features/vendors/share';
import { useLocale } from '@/i18n/locale-context';
import { Motion } from '@/lib/motion';

/** Where each tool stands today, said plainly. */
type Status = 'ready' | 'soon' | 'google' | 'approval' | 'notPossible';
type Tool = { key: string; icon: IconName; status: Status };

/**
 * My page → Connect your tools (the final look, 2026-10-23; researched
 * 2026-10-22): the apps vendors already live in, and honestly what each can
 * do with Wedded today. The calendar is the bridge that covers most of them
 * (Square, Acuity, Calendly and Vagaro all copy bookings into Google), and
 * nothing here pretends to be connected: Google and calendar links come next,
 * Instagram and TikTok wait on Meta's and TikTok's approval (#136, #137),
 * Booksy is closed to all but its partners. The page link works as soon as
 * Wedded's website has its domain (#148).
 */
export default function ConnectToolsScreen() {
  const styles = useStyles();
  const { t } = useLocale();
  const current = useCurrentBusiness();
  const listing = useMyListing(current.vendorId);
  const business = current.business;
  const linkReady = !SITE_URL_IS_PLACEHOLDER && business?.status === 'published';

  const groups: { key: string; tools: Tool[] }[] = [
    {
      key: 'calendars',
      tools: [
        { key: 'google', icon: 'logo-google', status: 'soon' },
        { key: 'calendarLink', icon: 'calendar-outline', status: 'soon' },
        { key: 'throughGoogle', icon: 'sync-outline', status: 'google' },
        { key: 'booksy', icon: 'hand-left-outline', status: 'notPossible' },
      ],
    },
    {
      key: 'photos',
      tools: [
        { key: 'instagram', icon: 'logo-instagram', status: 'approval' },
        { key: 'tiktok', icon: 'logo-tiktok', status: 'approval' },
      ],
    },
    {
      key: 'everywhere',
      tools: [
        { key: 'link', icon: 'link-outline', status: linkReady ? 'ready' : 'soon' },
        { key: 'website', icon: 'globe-outline', status: 'soon' },
      ],
    },
  ];

  return (
    <NavScreen title={t('connect.title')}>
      <AppText color="text2">{t('connect.intro')}</AppText>
      {groups.map((group, g) => (
        <View key={group.key} style={styles.group}>
          <AppText variant="caption" weight={600} color="text2" style={styles.caps}>
            {t(`connect.groups.${group.key}`).toUpperCase()}
          </AppText>
          <View style={styles.card}>
            {group.tools.map((tool, i) => (
              <Animated.View key={tool.key} entering={Motion.stagger(g * 3 + i)}>
                {i > 0 && <View style={styles.hairline} />}
                <ToolRow tool={tool}>
                  {tool.key === 'link' && linkReady && business && (
                    <Button
                      variant="secondary"
                      icon="share-outline"
                      label={t('connect.shareLink')}
                      onPress={() =>
                        void shareVendor(
                          {
                            name: business.name,
                            category: null,
                            city: listing.data?.city ?? '',
                            slug: business.slug,
                          },
                          t,
                        )
                      }
                    />
                  )}
                  {tool.key === 'booksy' && (
                    <Button
                      variant="secondary"
                      icon="calendar-outline"
                      label={t('connect.openCalendar')}
                      onPress={() => router.navigate('/calendar')}
                    />
                  )}
                </ToolRow>
              </Animated.View>
            ))}
          </View>
        </View>
      ))}
      <AppText variant="label" color="text2">
        {t('connect.footer')}
      </AppText>
    </NavScreen>
  );
}

function ToolRow({ tool, children }: { tool: Tool; children?: ReactNode }) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const ready = tool.status === 'ready';
  return (
    <View
      style={styles.row}
      accessible={!children}
      accessibilityLabel={`${t(`connect.tools.${tool.key}.name`)}. ${t(`connect.status.${tool.status}`)}. ${t(`connect.tools.${tool.key}.body`)}`}
    >
      <View style={styles.rowTop}>
        <View style={styles.iconBox}>
          <Icon name={tool.icon} size={22} color={Colors.text} />
        </View>
        <View style={styles.grow}>
          <AppText weight={600}>{t(`connect.tools.${tool.key}.name`)}</AppText>
          <View style={[styles.pill, ready && styles.pillReady]}>
            {ready && <Icon name="checkmark" size={12} color={Colors.success} weight="bold" />}
            <AppText variant="caption" weight={700} color={ready ? 'success' : 'text2'}>
              {t(`connect.status.${tool.status}`)}
            </AppText>
          </View>
        </View>
      </View>
      <AppText variant="label" color="text2">
        {t(`connect.tools.${tool.key}.body`)}
      </AppText>
      {children}
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  group: {
    gap: Spacing.sm,
  },
  caps: {
    letterSpacing: 0.6,
  },
  card: {
    overflow: 'hidden',
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  hairline: {
    height: 1,
    marginLeft: Spacing.lg,
    backgroundColor: Colors.separator,
  },
  row: {
    gap: Spacing.sm,
    padding: Spacing.lg,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bg,
  },
  grow: {
    flex: 1,
    gap: 4,
    alignItems: 'flex-start',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    minHeight: 22,
    borderRadius: Radius.chip,
    backgroundColor: Colors.bg,
  },
  pillReady: {
    backgroundColor: Colors.successTint,
  },
}));
