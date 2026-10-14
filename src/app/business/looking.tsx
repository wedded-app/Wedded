import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { NavScreen } from '@/components/nav';
import { Segmented } from '@/components/segmented';
import { StateView } from '@/components/state-view';
import { makeStyles, Spacing, useColors } from '@/constants/theme';
import {
  type LookingCard,
  requestProblem,
  useFamiliesLooking,
  useProStatus,
} from '@/data/requests';
import { useCurrentBusiness } from '@/features/business/use-current-business';
import { LookingPost, ProBadge } from '@/features/requests/request-parts';
import { ProTeaser } from '@/features/requests/pro-teaser';
import { useRequestWords } from '@/features/requests/use-request-words';
import { useLocale } from '@/i18n/locale-context';

type Reach = '25' | '50' | 'any';

/**
 * Families looking (#221): for vendors on Wedded Pro, requests from families
 * near them in their vendor types, newest first, laid out like Threads. Each
 * says if the vendor is free that day and how many proposals it has; "Send a
 * proposal" opens the composer. Free vendors see the teaser instead.
 */
export default function FamiliesLookingScreen() {
  const styles = useStyles();
  const { t } = useLocale();
  const { vendorId, isPending } = useCurrentBusiness();
  const pro = useProStatus(vendorId);
  const [reach, setReach] = useState<Reach>('50');
  const feed = useFamiliesLooking(vendorId, { maxMiles: reach === 'any' ? 500 : Number(reach) });
  const cards = feed.data?.pages.flat() ?? [];
  const isPro = pro.data?.plan === 'pro';
  const words = useRequestWords();

  let content;
  if (isPending || pro.isPending) {
    content = <StateView state="loading" />;
  } else if (!isPro || (feed.isError && requestProblem(feed.error) === 'proOnly')) {
    content = <ProTeaser vendorId={vendorId} />;
  } else if (feed.isPending) {
    content = <StateView state="loading" />;
  } else if (feed.isError) {
    content = <StateView state="error" onRetry={() => void feed.refetch()} />;
  } else if (cards.length === 0) {
    content = <StateView state="empty" icon="megaphone-outline" message={t('looking.empty')} />;
  } else {
    content = (
      <View>
        {cards.map((card, index) => (
          <View key={card.id}>
            {index > 0 && <View style={styles.hairline} />}
            <LookingPost
              familyName={card.familyName}
              city={card.city}
              ago={words.ago(card.postedAt)}
              headline={words.headline(card)}
              facts={words.facts(card, card.miles)}
              note={card.note}
              footer={<PostFooter card={card} />}
            />
          </View>
        ))}
        {feed.hasNextPage && (
          <Button
            variant="secondary"
            label={t('looking.more')}
            loading={feed.isFetchingNextPage}
            onPress={() => void feed.fetchNextPage()}
          />
        )}
      </View>
    );
  }

  return (
    <NavScreen title={t('looking.title')} subtitle={t('looking.subtitle')}>
      {isPro && (
        <View style={styles.filters}>
          <ProBadge />
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
        </View>
      )}
      {content}
    </NavScreen>
  );
}

/** Under a post: whether the vendor is free that day, the proposal count, and the action. */
function PostFooter({ card }: { card: LookingCard }) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const free = card.dateStatus === 'open';
  const busy = card.dateStatus === 'booked';
  return (
    <View style={styles.footer}>
      <View style={styles.meta}>
        {(free || busy) && (
          <View style={styles.metaItem}>
            <Icon
              name={free ? 'checkmark-circle' : 'close-circle-outline'}
              size={16}
              color={free ? Colors.success : Colors.error}
            />
            <AppText variant="label" weight={600} color={free ? 'success' : 'error'}>
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
          <Icon name="checkmark-circle" size={18} color={Colors.primary} />
          <AppText weight={600} color="primary">
            {t('looking.sent')}
          </AppText>
        </View>
      ) : card.proposalsFull ? (
        <AppText color="text2">{t('looking.full')}</AppText>
      ) : (
        <Button
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

const useStyles = makeStyles((Colors) => ({
  filters: {
    gap: Spacing.md,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 44 + Spacing.md,
    backgroundColor: Colors.separator,
  },
  footer: {
    gap: Spacing.md,
    marginTop: Spacing.xs,
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
}));
