import { router } from 'expo-router';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Icon, type IconName } from '@/components/icon';
import { OmbreBackground } from '@/components/ombre-background';
import { makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import { type Lead, useBusinessLeads } from '@/data/business';
import { useBusinessChecklist } from '@/data/business-insights';
import { useEventNames } from '@/features/business/business-parts';
import { PageChecklist } from '@/features/business/insights';
import { oldestWaiting } from '@/features/business/today';
import { useCurrentBusiness } from '@/features/business/use-current-business';
import { formatDate } from '@/features/inquiry/inquiry-helpers';
import { useRequestWords } from '@/features/requests/use-request-words';
import { WedMark } from '@/features/wed/wed-mark';
import { useLocale } from '@/i18n/locale-context';
import { Motion } from '@/lib/motion';

/** What Wed will do for a business once its brain is in (#124), said as "soon". */
const SOON: { key: string; icon: IconName }[] = [
  { key: 'replies', icon: 'chatbubble-ellipses-outline' },
  { key: 'quotes', icon: 'document-text-outline' },
  { key: 'reel', icon: 'film-outline' },
  { key: 'website', icon: 'globe-outline' },
  { key: 'monday', icon: 'calendar-outline' },
];

/**
 * Wed for a business (2026-10-23; canvas board "4 · The vendor side", the
 * bow): slides up from the bow in business mode's tab bar like a sheet. The
 * moving maroon top with the bow; then what needs the vendor now (the
 * families waiting longest, each opening their request), at most three ways
 * to make the page better, and, honestly, what Wed will do once its brain is
 * in: replies in their voice and quotes they send themselves, photos into a
 * reel after asking the family, their page filled from their website for
 * them to check, and a Monday reminder for calendars Wedded can't read.
 */
export default function BusinessWedScreen() {
  const Colors = useColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { t } = useLocale();
  const current = useCurrentBusiness();
  const leads = useBusinessLeads(current.vendorId);
  const checklist = useBusinessChecklist(current.vendorId);
  // iPhone shows this as a sheet below the status bar; elsewhere it's full screen
  const top = Platform.OS === 'ios' ? 0 : insets.top;

  const waiting = (leads.data ?? []).filter((lead) => !lead.replied);
  const first = oldestWaiting(leads.data ?? []);
  const ordered = first ? [first, ...waiting.filter((lead) => lead.id !== first.id)] : waiting;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: top + Spacing.lg }]}>
        <OmbreBackground />
        <View style={styles.headerTop}>
          <View style={styles.mode}>
            <AppText variant="caption" weight={700} style={styles.white}>
              {t('businessWed.mode')}
            </AppText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('businessWed.close')}
            onPress={() => router.back()}
            hitSlop={8}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          >
            <Icon name="chevron-down" size={22} color="#FFFFFF" weight="semibold" />
          </Pressable>
        </View>
        <View style={styles.headerWords}>
          <WedMark size={44} color="onPrimary" />
          <AppText weight={700} style={styles.title} accessibilityRole="header">
            {t('businessWed.title')}
          </AppText>
          {current.business && (
            <AppText weight={500} style={styles.subtitle}>
              {t('businessWed.forBusiness', { name: current.business.name })}
            </AppText>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xxl }]}
      >
        <Animated.View entering={Motion.enter} style={styles.block}>
          <AppText variant="section" accessibilityRole="header">
            {t('businessWed.needsYou')}
          </AppText>
          {ordered.length === 0 ? (
            <AppText color="text2">{t('businessWed.nobody')}</AppText>
          ) : (
            ordered.slice(0, 3).map((lead, index) => (
              <Animated.View key={lead.id} entering={Motion.stagger(index)}>
                <ReplyCard lead={lead} />
              </Animated.View>
            ))
          )}
        </Animated.View>

        {current.business && checklist.data && checklist.data.doneCount < checklist.data.total && (
          <Animated.View entering={Motion.enter}>
            <PageChecklist
              items={checklist.data.items}
              doneCount={checklist.data.doneCount}
              total={checklist.data.total}
              businessName={current.business.name}
              limit={3}
            />
          </Animated.View>
        )}

        <Animated.View entering={Motion.enter} style={styles.block}>
          <AppText variant="section" accessibilityRole="header">
            {t('businessWed.soonTitle')}
          </AppText>
          <AppText color="text2">{t('businessWed.soonBody')}</AppText>
          <View style={styles.soonList}>
            {SOON.map((item) => (
              <View key={item.key} style={styles.soonRow}>
                <Icon name={item.icon} size={22} color={Colors.primary} />
                <AppText style={styles.grow}>{t(`businessWed.soon.${item.key}`)}</AppText>
                <View style={styles.soonPill}>
                  <AppText variant="caption" weight={700} color="text2">
                    {t('connect.status.soon')}
                  </AppText>
                </View>
              </View>
            ))}
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

/** A family waiting for a reply, as one of Wed's cards: who, for what, since when; Reply opens it. */
function ReplyCard({ lead }: { lead: Lead }) {
  const styles = useStyles();
  const { t } = useLocale();
  const eventName = useEventNames();
  const words = useRequestWords();
  const who = lead.familyName ?? t('chat.aFamily');
  const what = [
    lead.eventSlugs.map(eventName).join(', ') || null,
    lead.eventDate ? formatDate(lead.eventDate) : null,
    words.ago(lead.createdAt),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.card}>
      <AppText variant="caption" weight={600} color="primary" style={styles.caps}>
        {t('businessWed.replyCaps').toUpperCase()}
      </AppText>
      <AppText variant="heading" weight={600}>
        {t('businessWed.waitingFor', { name: who })}
      </AppText>
      <AppText color="text2">{what}</AppText>
      <Button
        label={t('businessWed.reply')}
        onPress={() => {
          router.back();
          router.push({ pathname: '/business/lead', params: { id: lead.id } });
        }}
      />
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    gap: Spacing.xl,
    paddingHorizontal: Sizes.pageGutter,
    paddingBottom: Spacing.xl,
    overflow: 'hidden',
    backgroundColor: Colors.ombreBase,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mode: {
    minHeight: 28,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.chip,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  pressed: {
    opacity: 0.6,
  },
  headerWords: {
    gap: Spacing.xs,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.5,
    marginTop: Spacing.sm,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.88)',
  },
  white: {
    color: '#FFFFFF',
  },
  content: {
    gap: Spacing.xxl,
    paddingHorizontal: Sizes.pageGutter,
    paddingTop: Spacing.xl,
  },
  block: {
    gap: Spacing.md,
  },
  card: {
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  caps: {
    letterSpacing: 0.6,
  },
  soonList: {
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
  },
  soonRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
  },
  grow: {
    flex: 1,
  },
  soonPill: {
    paddingHorizontal: Spacing.sm,
    minHeight: 22,
    justifyContent: 'center',
    borderRadius: Radius.chip,
    backgroundColor: Colors.surface,
  },
}));
