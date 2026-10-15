import { router } from 'expo-router';
import { RefreshControl, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { NavScreen } from '@/components/nav';
import { PressableScale } from '@/components/pressable-scale';
import { StateView } from '@/components/state-view';
import { makeStyles, Radius, Spacing, useColors } from '@/constants/theme';
import { useMyRequests } from '@/data/requests';
import { useSession } from '@/features/auth/session';
import { useStartPlanning } from '@/features/onboarding/start';
import { usePlanView } from '@/features/planner/use-plan-view';
import { StatusPill } from '@/features/requests/request-parts';
import { useRequestWords } from '@/features/requests/use-request-words';
import { useLocale } from '@/i18n/locale-context';

/**
 * The Requests tab (#219, #253): a big "Post a request", then everything the
 * family has asked vendors for, newest first, each with how many proposals
 * came in. Signed out, or before there's a plan, it says what requests are
 * and offers the next step: sign in, or start the plan. /requests
 */
export default function RequestsScreen() {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const { status, requireSignIn, reloadProfile } = useSession();
  const startPlanning = useStartPlanning();
  const view = usePlanView();
  const requests = useMyRequests(view.wedding?.id ?? '');
  const words = useRequestWords();
  const postNew = () => router.push('/request-new');

  let content;
  if (status === 'signedOut' || status === 'needsProfile') {
    content = (
      <StateView
        state="empty"
        icon="megaphone-outline"
        message={t('requests.tab.signIn')}
        action={{
          label:
            status === 'needsProfile' ? t('profile.account.finish') : t('profile.account.signIn'),
          onPress: () => requireSignIn(),
        }}
      />
    );
  } else if (status === 'error') {
    content = <StateView state="error" onRetry={reloadProfile} />;
  } else if (view.loading || (view.wedding && requests.isPending)) {
    content = <StateView state="loading" />;
  } else if (!view.wedding) {
    content = (
      <StateView
        state="empty"
        icon="megaphone-outline"
        message={t('requests.post.needsPlan')}
        action={{ label: t('planner.startPlanning'), onPress: startPlanning }}
      />
    );
  } else if (requests.isError) {
    content = <StateView state="error" onRetry={() => void requests.refetch()} />;
  } else if ((requests.data ?? []).length === 0) {
    content = (
      <StateView state="empty" icon="megaphone-outline" message={t('requests.mine.empty')} />
    );
  } else {
    content = (requests.data ?? []).map((r) => {
      const facts = words.facts(r);
      const state = r.status === 'open' && r.expired ? 'expired' : r.status;
      const fresh = state === 'open' && r.proposalCount > 0;
      return (
        <PressableScale
          key={r.id}
          accessibilityRole="button"
          accessibilityLabel={[
            words.headline(r),
            t(`requests.status.${state}`),
            t('requests.mine.proposals', { count: r.proposalCount }),
          ].join(', ')}
          onPress={() => router.push({ pathname: '/request/[id]', params: { id: r.id } })}
          style={styles.card}
        >
          <View style={styles.top}>
            <StatusPill tone={state === 'open' ? 'open' : state === 'booked' ? 'done' : 'quiet'}>
              {t(`requests.status.${state}`)}
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
    <NavScreen
      title={t('tabs.requests')}
      subtitle={t('requests.post.body')}
      back={false}
      refreshControl={
        view.wedding ? (
          <RefreshControl
            refreshing={requests.isRefetching}
            onRefresh={() => void requests.refetch()}
            tintColor={Colors.chevron}
            colors={[Colors.primary]}
          />
        ) : undefined
      }
    >
      {view.wedding && <Button icon="add" label={t('requests.post.title')} onPress={postNew} />}
      {content}
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
