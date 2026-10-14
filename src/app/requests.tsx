import { router } from 'expo-router';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { StateView } from '@/components/state-view';
import { makeStyles, SchemeContext, Spacing, useColors } from '@/constants/theme';
import { useMyRequests } from '@/data/requests';
import { usePlanView } from '@/features/planner/use-plan-view';
import { GlassCard, GlowButton, NightScreen } from '@/features/requests/night';
import { RequestInvite } from '@/features/requests/request-invite';
import { useRequestWords } from '@/features/requests/use-request-words';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { Motion } from '@/lib/motion';

/**
 * Posted requests (#219): everything the family asked vendors for, each as
 * an invitation card with how many proposals came in. "Ask vendors" starts a
 * new one. /requests
 */
export default function PostedRequestsScreen() {
  return (
    <SchemeContext.Provider value="dark">
      <PostedRequests />
    </SchemeContext.Provider>
  );
}

function PostedRequests() {
  const Colors = useColors();
  const styles = useStyles();
  const { t, locale } = useLocale();
  const view = usePlanView();
  const requests = useMyRequests(view.wedding?.id ?? '');
  const words = useRequestWords();
  const ask = () => router.push('/request-new');
  const list = requests.data ?? [];

  let content;
  if (view.loading || (view.wedding && requests.isPending)) {
    content = <StateView state="loading" />;
  } else if (requests.isError) {
    content = <StateView state="error" onRetry={() => void requests.refetch()} />;
  } else if (list.length === 0) {
    content = (
      <GlassCard style={styles.empty}>
        <Icon name="megaphone-outline" size={34} color={Colors.champagne} />
        <AppText variant="heading" serif weight={600} style={styles.center}>
          {t('requests.mine.emptyTitle')}
        </AppText>
        <AppText color="text2" style={styles.center}>
          {t('requests.mine.empty')}
        </AppText>
      </GlassCard>
    );
  } else {
    content = list.map((r, i) => {
      const status = r.status === 'open' && r.expired ? 'expired' : r.status;
      const event = view.chosen.find((e) => e.slug === r.eventSlug);
      const fresh = status === 'open' && r.proposalCount > 0;
      return (
        <Animated.View key={r.id} entering={Motion.stagger(i)}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={[
              words.headline(r),
              words.facts(r).date,
              t(`requests.status.${status}`),
              t('requests.mine.proposals', { count: r.proposalCount }),
            ]
              .filter(Boolean)
              .join(', ')}
            onPress={() => router.push({ pathname: '/request/[id]', params: { id: r.id } })}
            pressedScale={0.98}
          >
            <RequestInvite
              eventName={event ? localized(event.name, locale) : null}
              headline={words.category(r.categorySlug)}
              date={r.eventDate}
              facts={words.facts(r)}
              sealed={status === 'open'}
              footer={
                <View style={styles.footer}>
                  <View style={[styles.count, fresh && styles.countFresh]}>
                    <AppText
                      weight={700}
                      color={fresh ? 'onHero' : 'text2'}
                      maxFontSizeMultiplier={1.4}
                    >
                      {String(r.proposalCount)}
                    </AppText>
                  </View>
                  <AppText weight={600} style={styles.grow}>
                    {status === 'open'
                      ? t('requests.mine.proposals', { count: r.proposalCount })
                      : t(`requests.status.${status}`)}
                  </AppText>
                  <AppText variant="label" weight={400} color="text2">
                    {words.ago(r.createdAt)}
                  </AppText>
                  <Icon name="chevron-forward" size={17} color={Colors.text2} weight="semibold" />
                </View>
              }
            />
          </PressableScale>
        </Animated.View>
      );
    });
  }

  return (
    <NightScreen
      eyebrow={t('requests.mine.eyebrow')}
      title={t('requests.mine.title')}
      subtitle={t('requests.mine.subtitle')}
      footer={<GlowButton icon="add" label={t('requests.post.title')} onPress={ask} />}
    >
      {content}
    </NightScreen>
  );
}

const useStyles = makeStyles((Colors) => ({
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  center: {
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  count: {
    minWidth: 34,
    height: 34,
    paddingHorizontal: Spacing.sm,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.nightCardStrong,
  },
  countFresh: {
    backgroundColor: Colors.primaryFill,
    boxShadow: Colors.roseGlow,
  },
  grow: {
    flex: 1,
  },
}));
