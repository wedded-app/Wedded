import { router } from 'expo-router';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { NavScreen } from '@/components/nav';
import { PressableScale } from '@/components/pressable-scale';
import { StateView } from '@/components/state-view';
import { makeStyles, Radius, Spacing, useColors } from '@/constants/theme';
import { useMyRequests } from '@/data/requests';
import { usePlanView } from '@/features/planner/use-plan-view';
import { StatusPill } from '@/features/requests/request-parts';
import { useRequestWords } from '@/features/requests/use-request-words';
import { useLocale } from '@/i18n/locale-context';

/**
 * My requests (#219): everything the family has asked vendors for, newest
 * first, each with how many proposals came in. "Post a request" starts a new
 * one. /requests
 */
export default function MyRequestsScreen() {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const view = usePlanView();
  const requests = useMyRequests(view.wedding?.id ?? '');
  const words = useRequestWords();
  const postNew = () => router.push('/request-new');

  let content;
  if (view.loading || (view.wedding && requests.isPending)) {
    content = <StateView state="loading" />;
  } else if (requests.isError) {
    content = <StateView state="error" onRetry={() => void requests.refetch()} />;
  } else if ((requests.data ?? []).length === 0) {
    content = (
      <StateView
        state="empty"
        icon="megaphone-outline"
        message={t('requests.mine.empty')}
        action={{ label: t('requests.post.title'), onPress: postNew }}
      />
    );
  } else {
    content = (requests.data ?? []).map((r) => {
      const facts = words.facts(r);
      const status = r.status === 'open' && r.expired ? 'expired' : r.status;
      const fresh = status === 'open' && r.proposalCount > 0;
      return (
        <PressableScale
          key={r.id}
          accessibilityRole="button"
          accessibilityLabel={[
            words.headline(r),
            t(`requests.status.${status}`),
            t('requests.mine.proposals', { count: r.proposalCount }),
          ].join(', ')}
          onPress={() => router.push({ pathname: '/request/[id]', params: { id: r.id } })}
          style={styles.card}
        >
          <View style={styles.top}>
            <StatusPill tone={status === 'open' ? 'open' : status === 'booked' ? 'done' : 'quiet'}>
              {t(`requests.status.${status}`)}
            </StatusPill>
            <AppText variant="label" weight={400} color="text2">
              {words.ago(r.createdAt)}
            </AppText>
          </View>
          <AppText variant="bodyLg" weight={600}>
            {words.headline(r)}
          </AppText>
          <AppText color="text2">{[facts.date, facts.budget].filter(Boolean).join(' · ')}</AppText>
          <View style={styles.count}>
            <View style={[styles.badge, fresh && styles.badgeFresh]}>
              <AppText
                weight={700}
                color={fresh ? 'onPrimary' : 'text2'}
                maxFontSizeMultiplier={1.4}
              >
                {String(r.proposalCount)}
              </AppText>
            </View>
            <AppText weight={600} style={styles.grow}>
              {t('requests.mine.proposals', { count: r.proposalCount })}
            </AppText>
            <Icon name="chevron-forward" size={17} color={Colors.chevron} weight="semibold" />
          </View>
        </PressableScale>
      );
    });
  }

  return (
    <NavScreen title={t('requests.mine.title')} subtitle={t('requests.mine.subtitle')}>
      {content}
      {requests.data && requests.data.length > 0 && (
        <Button icon="add" label={t('requests.post.title')} onPress={postNew} />
      )}
    </NavScreen>
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
    justifyContent: 'space-between',
  },
  count: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  badge: {
    minWidth: 32,
    height: 32,
    paddingHorizontal: Spacing.sm,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.fill,
  },
  badgeFresh: {
    backgroundColor: Colors.primaryFill,
  },
  grow: {
    flex: 1,
  },
}));
