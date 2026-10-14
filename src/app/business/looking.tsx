import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Icon, type IconName } from '@/components/icon';
import { Segmented } from '@/components/segmented';
import { StateView } from '@/components/state-view';
import { makeStyles, Radius, SchemeContext, Spacing, useColors } from '@/constants/theme';
import {
  type LookingCard,
  requestProblem,
  useFamiliesLooking,
  useFamiliesLookingSummary,
  useProStatus,
} from '@/data/requests';
import { useCurrentBusiness } from '@/features/business/use-current-business';
import { DateTile, GlassCard, GlowButton, NightScreen } from '@/features/requests/night';
import { FamilyAvatar } from '@/features/requests/request-parts';
import { useRequestWords } from '@/features/requests/use-request-words';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { useCountUp } from '@/lib/use-count-up';

type Reach = '25' | '50' | 'any';

/**
 * Families looking (#221), on the night page: for Wedded Pro vendors, a calm
 * Threads-like feed of families near them who need what they do. Each post:
 * the family's letters, name, town and how long ago, the date as a calendar
 * page, what they need, guests, budget and distance, their note, whether the
 * vendor is free that day, then Send a proposal. Free vendors get the
 * teaser: the real count, big, over soft blurred posts, and Wedded Pro.
 */
export default function FamiliesLookingScreen() {
  return (
    <SchemeContext.Provider value="dark">
      <FamiliesLooking />
    </SchemeContext.Provider>
  );
}

function FamiliesLooking() {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const { vendorId, isPending } = useCurrentBusiness();
  const pro = useProStatus(vendorId);
  const [reach, setReach] = useState<Reach>('50');
  const feed = useFamiliesLooking(vendorId, { maxMiles: reach === 'any' ? 500 : Number(reach) });
  const cards = feed.data?.pages.flat() ?? [];
  const isPro = pro.data?.plan === 'pro';
  const locked = !isPro || (feed.isError && requestProblem(feed.error) === 'proOnly');

  if (isPending || pro.isPending) {
    return (
      <NightScreen>
        <StateView state="loading" />
      </NightScreen>
    );
  }
  if (locked) return <Teaser vendorId={vendorId} />;

  let content;
  if (feed.isPending) {
    content = <StateView state="loading" />;
  } else if (feed.isError) {
    content = <StateView state="error" onRetry={() => void feed.refetch()} />;
  } else if (cards.length === 0) {
    content = (
      <GlassCard style={styles.empty}>
        <Icon name="megaphone-outline" size={32} color={Colors.champagne} />
        <AppText color="text2" style={styles.center}>
          {t('looking.empty')}
        </AppText>
      </GlassCard>
    );
  } else {
    content = (
      <View>
        {cards.map((card, index) => (
          <Animated.View
            key={card.id}
            entering={FadeInDown.delay(Math.min(index, 6) * 70).duration(360)}
          >
            {index > 0 && <View style={styles.hairline} />}
            <Post card={card} />
          </Animated.View>
        ))}
        {feed.hasNextPage && (
          <GlowButton
            glass
            label={t('looking.more')}
            loading={feed.isFetchingNextPage}
            onPress={() => void feed.fetchNextPage()}
          />
        )}
      </View>
    );
  }

  return (
    <NightScreen
      eyebrow={t('pro.eyebrow')}
      title={t('looking.title')}
      subtitle={t('looking.subtitle')}
    >
      <Segmented<Reach>
        accessibilityLabel={t('looking.reach')}
        value={reach}
        onChange={setReach}
        options={[
          { value: '25', label: t('looking.miles', { count: 25 }) },
          { value: '50', label: t('looking.miles', { count: 50 }) },
          { value: 'any', label: t('looking.anywhere') },
        ]}
      />
      {content}
    </NightScreen>
  );
}

function Fact({ icon, children }: { icon: IconName; children: string }) {
  const Colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.fact}>
      <Icon name={icon} size={15} color={Colors.champagne} />
      <AppText variant="label" weight={600}>
        {children}
      </AppText>
    </View>
  );
}

/** One family's request, Threads-style. */
function Post({ card }: { card: LookingCard }) {
  const Colors = useColors();
  const styles = useStyles();
  const { t, locale } = useLocale();
  const words = useRequestWords();
  const facts = words.facts(card, card.miles);
  const free = card.dateStatus === 'open';
  const busy = card.dateStatus === 'booked';
  const headline = localized(card.categoryName, locale);
  const event = card.eventName ? localized(card.eventName, locale) : null;

  return (
    <View style={styles.post}>
      <View style={styles.byline}>
        <FamilyAvatar name={card.familyName} />
        <View style={styles.grow}>
          <AppText weight={700}>{card.familyName}</AppText>
          <AppText variant="label" weight={400} color="text2">
            {[card.city, words.ago(card.postedAt)].join(' · ')}
          </AppText>
        </View>
      </View>

      <View style={styles.what}>
        {card.eventDate ? <DateTile date={card.eventDate} /> : null}
        <View style={styles.grow}>
          {event ? (
            <AppText variant="label" weight={700} color="champagne">
              {event.toUpperCase()}
            </AppText>
          ) : null}
          <AppText variant="title" serif weight={600}>
            {headline}
          </AppText>
        </View>
      </View>

      <View style={styles.facts}>
        {facts.guests && <Fact icon="people-outline">{facts.guests}</Fact>}
        {facts.budget && <Fact icon="cash-outline">{facts.budget}</Fact>}
        {facts.distance && <Fact icon="location-outline">{facts.distance}</Fact>}
      </View>

      {card.note ? <AppText style={styles.note}>{`“${card.note}”`}</AppText> : null}

      <View style={styles.meta}>
        {(free || busy) && (
          <View style={styles.metaItem}>
            <Icon
              name={free ? 'checkmark-circle' : 'close-circle-outline'}
              size={17}
              color={free ? Colors.success : Colors.error}
            />
            <AppText variant="label" weight={700} color={free ? 'success' : 'error'}>
              {t(free ? 'looking.free' : 'looking.booked')}
            </AppText>
          </View>
        )}
        <AppText variant="label" weight={500} color="text2">
          {card.proposalCount === 0
            ? t('looking.first')
            : t('looking.proposals', { count: card.proposalCount })}
        </AppText>
      </View>

      {card.alreadyProposed ? (
        <View style={styles.sent}>
          <Icon name="checkmark-circle" size={20} color={Colors.champagne} />
          <AppText weight={700} color="champagne">
            {t('looking.sent')}
          </AppText>
        </View>
      ) : card.proposalsFull ? (
        <AppText color="text2">{t('looking.full')}</AppText>
      ) : (
        <GlowButton
          icon="paper-plane-outline"
          label={t('looking.propose')}
          onPress={() =>
            router.push({ pathname: '/business/propose', params: { request: card.id } })
          }
        />
      )}
    </View>
  );
}

/** For vendors not on Pro: the real count, big, over blurred posts, and Wedded Pro. */
function Teaser({ vendorId }: { vendorId: string }) {
  const styles = useStyles();
  const { t, locale } = useLocale();
  const summary = useFamiliesLookingSummary(vendorId);
  const total = summary.data?.total ?? 0;
  const shown = useCountUp(total, 1100);
  const top = [...(summary.data?.byCategory ?? [])].sort((a, b) => b.count - a.count)[0];
  const what =
    top && summary.data?.byCategory.length === 1
      ? t('looking.teaser.needCategory', {
          count: total,
          category: localized(top.categoryName, locale),
        })
      : t('looking.teaser.need', { count: total });

  return (
    <NightScreen
      eyebrow={t('pro.eyebrow')}
      footer={
        <GlowButton
          icon="sparkles"
          label={t('looking.teaser.goPro')}
          onPress={() => router.push('/business/pro')}
        />
      }
    >
      <View style={styles.hero}>
        <AppText serif weight={600} style={styles.bigNumber} maxFontSizeMultiplier={1.2}>
          {String(shown)}
        </AppText>
        <AppText variant="title" serif weight={500} style={styles.center}>
          {what}
        </AppText>
        <AppText variant="bodyLg" color="text2" style={styles.center}>
          {t('looking.teaser.body')}
        </AppText>
      </View>
      {/* Soft, unreadable stand-ins for the posts Pro unlocks: never real details */}
      <View
        style={styles.ghosts}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      >
        {[0, 1, 2].map((i) => (
          <GlassCard key={i} style={[styles.ghost, { opacity: 0.55 - i * 0.15 }]}>
            <View style={styles.ghostRow}>
              <View style={styles.ghostDot} />
              <View style={[styles.ghostBar, { width: '40%' }]} />
            </View>
            <View style={[styles.ghostBar, styles.ghostTall, { width: '70%' }]} />
            <View style={[styles.ghostBar, { width: '90%' }]} />
            <View style={[styles.ghostBar, { width: '55%' }]} />
          </GlassCard>
        ))}
      </View>
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
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.nightLine,
  },
  post: {
    gap: Spacing.md,
    paddingVertical: Spacing.xl,
  },
  byline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  what: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  facts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  fact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: Radius.chip,
    backgroundColor: Colors.nightCard,
    borderWidth: 1,
    borderColor: Colors.nightLine,
  },
  note: {
    fontStyle: 'italic',
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: Spacing.md,
    rowGap: Spacing.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  sent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 48,
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingTop: Spacing.xl,
  },
  bigNumber: {
    fontSize: 120,
    lineHeight: 132,
    color: Colors.champagne,
    fontVariant: ['tabular-nums'],
  },
  ghosts: {
    gap: Spacing.md,
  },
  ghost: {
    gap: Spacing.sm,
  },
  ghostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  ghostDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.nightCardStrong,
  },
  ghostBar: {
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.nightCardStrong,
  },
  ghostTall: {
    height: 20,
  },
}));
