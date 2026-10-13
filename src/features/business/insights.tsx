import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { router } from 'expo-router';
import { Linking, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Icon, type IconName } from '@/components/icon';
import { SectionTitle } from '@/components/list';
import { ProgressBar } from '@/components/progress-bar';
import { makeStyles, Radius, Spacing, useColors } from '@/constants/theme';
import {
  type Asks,
  type BusinessReel,
  busiestDay,
  type ChecklistItem,
  type Compare,
  type DailyNumbers,
  type Funnel,
  needsReplyNudge,
  type Replies,
  stepRate,
} from '@/data/business-insights';
import { compactCount } from '@/data/reels';
import { formatDate } from '@/features/inquiry/inquiry-helpers';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

import { barShares, fixTarget, monthLabel, replyLine } from './insights-format';

/** The team's WhatsApp for "Fix it" on what only we can change for now (no self-edit yet). */
const TEAM_WHATSAPP = (process.env.EXPO_PUBLIC_TEAM_WHATSAPP ?? '').replace(/\D/g, '');

/** A white card with a section title, the shape every block here takes. */
function Block({ title, children }: { title: string; children: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.block}>
      <SectionTitle>{title}</SectionTitle>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

/**
 * Page views per day as plain bars, oldest on the left, with the first and
 * last day under them and the busiest day in words. Read as one sentence.
 */
export function ViewsChart({ daily }: { daily: DailyNumbers[] }) {
  const styles = useStyles();
  const { t } = useLocale();
  const busiest = busiestDay(daily);
  const total = daily.reduce((sum, d) => sum + d.views, 0);
  const shares = barShares(daily.map((d) => d.views));
  const summary =
    busiest && busiest.views > 0
      ? t('business.insights.chartBusiest', {
          date: formatDate(busiest.day),
          count: busiest.views,
        })
      : t('business.insights.chartEmpty');

  return (
    <Block title={t('business.insights.chartTitle')}>
      <View
        accessible
        accessibilityLabel={`${t('business.insights.chartTitle')}. ${t('business.insights.chartTotal', { count: total })}. ${summary}`}
        style={styles.chartWrap}
      >
        <View style={styles.chart}>
          {daily.map((d, i) => (
            <View key={d.day} style={styles.barSlot}>
              <View
                style={[
                  styles.bar,
                  { height: `${Math.max(shares[i] * 100, d.views > 0 ? 4 : 1)}%` },
                  d.views === 0 && styles.barEmpty,
                ]}
              />
            </View>
          ))}
        </View>
        {daily.length > 0 && (
          <View style={styles.chartEnds}>
            <AppText variant="caption" color="text2">
              {formatDate(daily[0].day)}
            </AppText>
            <AppText variant="caption" color="text2">
              {formatDate(daily[daily.length - 1].day)}
            </AppText>
          </View>
        )}
      </View>
      <AppText>{summary}</AppText>
    </Block>
  );
}

const FUNNEL: { key: keyof Funnel; icon: IconName }[] = [
  { key: 'searches', icon: 'search' },
  { key: 'views', icon: 'eye-outline' },
  { key: 'saves', icon: 'heart-outline' },
  { key: 'contacts', icon: 'call-outline' },
  { key: 'inquiries', icon: 'mail-outline' },
  { key: 'booked', icon: 'checkmark-circle-outline' },
];

/** From seen to booked: each step's number, and how many of the step before got there. */
export function FunnelSteps({ funnel }: { funnel: Funnel }) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  return (
    <Block title={t('business.insights.funnelTitle')}>
      {FUNNEL.map(({ key, icon }, i) => {
        const before = i > 0 ? funnel[FUNNEL[i - 1].key] : null;
        const rate = before === null ? null : stepRate(before, funnel[key]);
        const rateWords = rate === null ? null : t('business.insights.ofThose', { percent: rate });
        return (
          <View
            key={key}
            style={[styles.step, i > 0 && styles.divided]}
            accessible
            accessibilityLabel={[
              `${funnel[key]} ${t(`business.insights.funnel.${key}`)}`,
              rateWords,
            ]
              .filter(Boolean)
              .join(', ')}
          >
            <Icon name={icon} size={22} color={Colors.primary} />
            <AppText variant="title" style={styles.stepNumber}>
              {funnel[key].toLocaleString('en-US')}
            </AppText>
            <View style={styles.grow}>
              <AppText weight={600}>{t(`business.insights.funnel.${key}`)}</AppText>
              {rateWords && (
                <AppText variant="label" weight={400} color="text2">
                  {rateWords}
                </AppText>
              )}
            </View>
          </View>
        );
      })}
    </Block>
  );
}

/** "You replied to 9 of 10 families, usually within 2 hours", and a gentle nudge when it's slow. */
export function ReplySpeed({ replies }: { replies: Replies }) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const line = replyLine(replies, t);
  const nudge = needsReplyNudge(replies);
  return (
    <Block title={t('business.insights.replyTitle')}>
      <AppText variant="bodyLg" weight={600}>
        {line ?? t('business.insights.replyNone')}
      </AppText>
      {nudge && (
        <View style={styles.nudge}>
          <Icon name="bulb-outline" size={22} color={Colors.kesari} />
          <AppText style={styles.grow}>{t('business.insights.replyNudge')}</AppText>
        </View>
      )}
    </Block>
  );
}

/** One list in What families want: a label, its count and a bar for its share. */
function AskList({
  title,
  rows,
}: {
  title: string;
  rows: { key: string; label: string; count: number }[];
}) {
  const Colors = useColors();
  const styles = useStyles();
  if (rows.length === 0) return null;
  const shares = barShares(rows.map((r) => r.count));
  return (
    <View style={styles.askList}>
      <AppText variant="label" weight={600} color="text2">
        {title}
      </AppText>
      {rows.map((row, i) => (
        <View
          key={row.key}
          style={styles.askRow}
          accessible
          accessibilityLabel={`${row.label}: ${row.count}`}
        >
          <View style={styles.askText}>
            <AppText style={styles.grow}>{row.label}</AppText>
            <AppText weight={700} style={styles.tabular}>
              {String(row.count)}
            </AppText>
          </View>
          <ProgressBar value={shares[i]} color={Colors.primaryFill} trackColor={Colors.fill} />
        </View>
      ))}
    </View>
  );
}

/** What families ask about: their events, guest sizes, wedding months and towns. */
export function WhatFamiliesWant({ asks }: { asks: Asks }) {
  const { t, locale } = useLocale();
  const empty =
    asks.events.length + asks.guests.length + asks.months.length + asks.places.length === 0;
  return (
    <Block title={t('business.insights.wantTitle')}>
      {empty ? (
        <AppText color="text2">{t('business.insights.wantEmpty')}</AppText>
      ) : (
        <>
          <AskList
            title={t('business.insights.want.events')}
            rows={asks.events.map((e) => ({
              key: e.slug,
              label: localized(e.name, locale),
              count: e.count,
            }))}
          />
          <AskList
            title={t('business.insights.want.guests')}
            rows={asks.guests.map((g) => ({
              key: g.band,
              label: t(`inquiry.guestBands.${g.band}`),
              count: g.count,
            }))}
          />
          <AskList
            title={t('business.insights.want.months')}
            rows={asks.months.map((m) => ({
              key: m.month,
              label: monthLabel(m.month, t),
              count: m.count,
            }))}
          />
          <AskList
            title={t('business.insights.want.places')}
            rows={asks.places.map((p) => ({ key: p.place, label: p.place, count: p.count }))}
          />
        </>
      )}
    </Block>
  );
}

/** Their views and requests next to the typical vendor of their kind nearby. */
export function HowYouCompare({ compare }: { compare: Compare }) {
  const Colors = useColors();
  const styles = useStyles();
  const { t, locale } = useLocale();
  const kind = localized(compare.category.name, locale);
  const rows: { key: 'views' | 'inquiries'; mine: number; typical: number }[] = [
    { key: 'views', ...compare.views },
    { key: 'inquiries', ...compare.inquiries },
  ];
  return (
    <Block title={t('business.insights.compareTitle')}>
      <AppText color="text2">
        {t('business.insights.compareIntro', { count: compare.peers, kind })}
      </AppText>
      {rows.map(({ key, mine, typical }) => {
        const shares = barShares([mine, typical]);
        const verdict = mine > typical ? 'above' : mine < typical ? 'below' : 'same';
        return (
          <View key={key} style={styles.compareRow}>
            <AppText weight={700}>{t(`business.insights.compare.${key}`)}</AppText>
            <View
              style={styles.askRow}
              accessible
              accessibilityLabel={`${t('business.insights.compare.you')}: ${mine}`}
            >
              <View style={styles.askText}>
                <AppText style={styles.grow}>{t('business.insights.compare.you')}</AppText>
                <AppText weight={700} style={styles.tabular}>
                  {mine.toLocaleString('en-US')}
                </AppText>
              </View>
              <ProgressBar value={shares[0]} color={Colors.primaryFill} trackColor={Colors.fill} />
            </View>
            <View
              style={styles.askRow}
              accessible
              accessibilityLabel={`${t('business.insights.compare.typical')}: ${typical}`}
            >
              <View style={styles.askText}>
                <AppText style={styles.grow}>{t('business.insights.compare.typical')}</AppText>
                <AppText weight={700} style={styles.tabular}>
                  {typical.toLocaleString('en-US')}
                </AppText>
              </View>
              <ProgressBar value={shares[1]} color={Colors.textDisabled} trackColor={Colors.fill} />
            </View>
            <AppText variant="label" weight={600} color={verdict === 'below' ? 'text2' : 'success'}>
              {t(`business.insights.compare.${verdict}`)}
            </AppText>
          </View>
        );
      })}
    </Block>
  );
}

/** Their reels and the ones families tagged them in, each with views, likes and comments. */
export function YourReels({ reels }: { reels: BusinessReel[] }) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  return (
    <Block title={t('business.insights.reelsTitle')}>
      {reels.length === 0 ? (
        <>
          <AppText color="text2">{t('business.insights.reelsEmpty')}</AppText>
          <Button
            variant="secondary"
            icon="film-outline"
            label={t('business.insights.postReel')}
            onPress={() => router.push('/post-reel')}
          />
        </>
      ) : (
        reels.map((reel, i) => {
          const counts = t('business.insights.reelCounts', {
            views: compactCount(reel.views),
            likes: compactCount(reel.likes),
            comments: compactCount(reel.comments),
          });
          return (
            <View
              key={reel.id}
              style={[styles.reel, i > 0 && styles.divided]}
              accessible
              accessibilityLabel={[
                reel.caption ?? t('business.insights.noCaption'),
                reel.own ? null : t('business.insights.tagged'),
                counts,
              ]
                .filter(Boolean)
                .join(', ')}
            >
              {reel.thumbUrl ? (
                <Image source={{ uri: reel.thumbUrl }} contentFit="cover" style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbEmpty]}>
                  <Icon name="film-outline" size={22} color={Colors.primary} />
                </View>
              )}
              <View style={styles.grow}>
                <AppText numberOfLines={2} weight={600}>
                  {reel.caption ?? t('business.insights.noCaption')}
                </AppText>
                {!reel.own && (
                  <AppText variant="label" weight={600} color="kesari">
                    {t('business.insights.tagged')}
                  </AppText>
                )}
                <AppText variant="label" weight={400} color="text2">
                  {counts}
                </AppText>
              </View>
            </View>
          );
        })
      )}
    </Block>
  );
}

/**
 * What their page has and is missing: "8 of 12 done" with a bar, then each
 * missing item with what it gains them and Fix it, then the done ones.
 */
export function PageChecklist({
  items,
  doneCount,
  total,
  businessName,
}: {
  items: ChecklistItem[];
  doneCount: number;
  total: number;
  businessName: string;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const missing = items.filter((item) => !item.done);
  const done = items.filter((item) => item.done);
  const askTeam = (what: string) =>
    void Linking.openURL(
      `https://wa.me/${TEAM_WHATSAPP}?text=${encodeURIComponent(
        t('business.checklist.teamMessage', { name: businessName, what }),
      )}`,
    );

  return (
    <Block title={t('business.checklist.title')}>
      <AppText variant="bodyLg" weight={700}>
        {t('business.checklist.progress', { done: doneCount, total })}
      </AppText>
      <ProgressBar
        value={total > 0 ? doneCount / total : 0}
        color={Colors.success}
        trackColor={Colors.fill}
        height={10}
      />
      {missing.map((item) => {
        const target = fixTarget(item.key);
        const what = t(`business.checklist.items.${item.key}.title`);
        return (
          <View key={item.key} style={[styles.todo, styles.divided]}>
            <AppText weight={700}>{what}</AppText>
            <AppText color="text2">
              {t(`business.checklist.items.${item.key}.gain`, { count: item.count ?? 0 })}
            </AppText>
            {target !== 'team' ? (
              <Button
                variant="secondary"
                label={t('business.checklist.fix')}
                onPress={() => router.push(target)}
              />
            ) : TEAM_WHATSAPP ? (
              <Button
                variant="secondary"
                icon="logo-whatsapp"
                label={t('business.checklist.askTeam')}
                onPress={() => askTeam(what)}
              />
            ) : (
              <AppText variant="label" weight={400} color="text2">
                {t('business.checklist.tellTeam')}
              </AppText>
            )}
          </View>
        );
      })}
      {done.length > 0 && (
        <View style={[styles.doneList, styles.divided]}>
          <Icon name="checkmark-circle" size={20} color={Colors.success} />
          <AppText color="text2" style={styles.grow}>
            {t('business.checklist.done', {
              list: done.map((item) => t(`business.checklist.items.${item.key}.title`)).join(', '),
            })}
          </AppText>
        </View>
      )}
    </Block>
  );
}

const useStyles = makeStyles((Colors) => ({
  block: {
    gap: Spacing.md,
  },
  card: {
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  grow: {
    flex: 1,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  divided: {
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  chartWrap: {
    gap: Spacing.xs,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 120,
    gap: 2,
  },
  barSlot: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    backgroundColor: Colors.primaryFill,
  },
  barEmpty: {
    backgroundColor: Colors.fill,
  },
  chartEnds: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  stepNumber: {
    minWidth: 56,
    fontVariant: ['tabular-nums'],
  },
  nudge: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.card,
    backgroundColor: Colors.kesariTint,
  },
  askList: {
    gap: Spacing.sm,
  },
  askRow: {
    gap: 4,
  },
  askText: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
  },
  compareRow: {
    gap: Spacing.sm,
  },
  reel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  thumb: {
    width: 56,
    height: 72,
    borderRadius: 8,
    backgroundColor: Colors.skeleton,
  },
  thumbEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryTint,
  },
  todo: {
    gap: Spacing.xs,
  },
  doneList: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
}));
