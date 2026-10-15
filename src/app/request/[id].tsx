import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Platform, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { NavScreen } from '@/components/nav';
import { PressableScale } from '@/components/pressable-scale';
import { StateView } from '@/components/state-view';
import { makeStyles, Radius, Spacing, useColors } from '@/constants/theme';
import { useVendorDateStatus } from '@/data/availability';
import {
  type Proposal,
  requestProblem,
  useAnswerProposal,
  useCloseRequest,
  useMyRequests,
  useRequestProposals,
} from '@/data/requests';
import { useVendorPublicStats } from '@/data/vendor-stats';
import { usePlanView } from '@/features/planner/use-plan-view';
import { StatusPill, VendorThumb } from '@/features/requests/request-parts';
import { useRequestWords } from '@/features/requests/use-request-words';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { successHaptic } from '@/lib/haptics';
import { Motion } from '@/lib/motion';

const dollars = (cents: number) =>
  (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });

/** A yes-or-no question, as an alert on phones and confirm() in a browser. */
function ask(title: string, body: string, yes: string, no: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm(body)) onYes();
    return;
  }
  Alert.alert(title, body, [
    { text: no, style: 'cancel' },
    { text: yes, onPress: onYes },
  ]);
}

/**
 * One request and its proposals (#219): what the family asked for, then each
 * vendor's price, note and record, the chosen one first, then lowest price
 * first, to compare. Choose opens the chat with that vendor; No thanks
 * declines. Close the request when they're done. /request/{id}
 */
export default function RequestScreen() {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const { id = '', posted } = useLocalSearchParams<{ id: string; posted?: string }>();
  const view = usePlanView();
  const weddingId = view.wedding?.id ?? '';
  const requests = useMyRequests(weddingId);
  const proposals = useRequestProposals(id);
  const answer = useAnswerProposal(id);
  const close = useCloseRequest(weddingId);
  const words = useRequestWords();
  const request = requests.data?.find((r) => r.id === id);

  if (requests.isPending || view.loading) return <StateView state="loading" />;
  if (!request) {
    return <StateView state="empty" icon="megaphone-outline" message={t('requests.gone')} />;
  }

  const live = (proposals.data ?? []).filter((p) => p.status !== 'withdrawn');
  // The chosen one first, then lowest price, then those without a price
  const sorted = [...live].sort(
    (a, b) =>
      Number(b.status === 'accepted') - Number(a.status === 'accepted') ||
      (a.priceCents ?? Infinity) - (b.priceCents ?? Infinity),
  );
  const prices = live.map((p) => p.priceCents).filter((c): c is number => c != null);
  const lowest = prices.length > 1 ? Math.min(...prices) : null;
  const open = request.status === 'open' && !request.expired;

  const choose = (p: Proposal, vendorName: string) =>
    ask(
      t('requests.inbox.acceptTitle'),
      p.priceCents != null
        ? t('requests.inbox.acceptBody', { vendor: vendorName, price: dollars(p.priceCents) })
        : t('requests.inbox.acceptBodyNoPrice', { vendor: vendorName }),
      t('requests.inbox.accept'),
      t('requests.inbox.notYet'),
      () =>
        answer.mutate(
          { proposalId: p.id, accept: true },
          {
            onSuccess: ({ conversationId }) => {
              successHaptic();
              if (conversationId) {
                router.push({ pathname: '/chat/[id]', params: { id: conversationId } });
              }
            },
          },
        ),
    );

  const status = request.expired && request.status === 'open' ? 'expired' : request.status;

  return (
    <NavScreen title={words.headline(request)} subtitle={t('requests.inbox.subtitle')}>
      {posted === '1' && (
        <Animated.View entering={Motion.rise} style={styles.posted}>
          <Icon name="checkmark-circle" size={22} color={Colors.success} />
          <AppText weight={600} style={styles.grow}>
            {t('requests.inbox.posted')}
          </AppText>
        </Animated.View>
      )}

      <View style={styles.summary}>
        <StatusPill tone={open ? 'open' : request.status === 'booked' ? 'done' : 'quiet'}>
          {t(`requests.status.${status}`)}
        </StatusPill>
        <View style={styles.facts}>
          {Object.values(words.facts(request))
            .filter((v): v is string => !!v)
            .map((fact) => (
              <AppText key={fact} color="text2">
                {fact}
              </AppText>
            ))}
        </View>
        {request.note ? <AppText>{request.note}</AppText> : null}
      </View>

      <AppText variant="section" accessibilityRole="header">
        {t('requests.inbox.proposals', { count: live.length })}
      </AppText>

      {proposals.isPending ? (
        <StateView state="loading" />
      ) : sorted.length === 0 ? (
        <View style={styles.waiting}>
          <Icon name="time-outline" size={28} color={Colors.text2} />
          <AppText color="text2" style={styles.center}>
            {t('requests.inbox.none')}
          </AppText>
        </View>
      ) : (
        sorted.map((p) => (
          <ProposalCard
            key={p.id}
            proposal={p}
            eventDate={request.eventDate}
            lowest={p.priceCents != null && p.priceCents === lowest}
            canAnswer={open && p.status === 'sent'}
            busy={answer.isPending}
            onChoose={(name) => choose(p, name)}
            onDecline={() => answer.mutate({ proposalId: p.id, accept: false })}
          />
        ))
      )}

      {answer.isError && (
        <AppText color="error">{t(`requests.problems.${requestProblem(answer.error)}`)}</AppText>
      )}

      {open && (
        <Button
          variant="text"
          label={t('requests.inbox.close')}
          onPress={() =>
            ask(
              t('requests.inbox.closeTitle'),
              t('requests.inbox.closeBody'),
              t('requests.inbox.closeYes'),
              t('requests.inbox.notYet'),
              () => close.mutate({ requestId: request.id, booked: false }),
            )
          }
        />
      )}
    </NavScreen>
  );
}

function ProposalCard({
  proposal: p,
  eventDate,
  lowest,
  canAnswer,
  busy,
  onChoose,
  onDecline,
}: {
  proposal: Proposal;
  eventDate: string | null;
  lowest: boolean;
  canAnswer: boolean;
  busy: boolean;
  onChoose: (vendorName: string) => void;
  onDecline: () => void;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const name = localized(p.vendor.name);
  const stats = useVendorPublicStats(p.vendor.id);
  const free = useVendorDateStatus(p.vendor.id, eventDate);
  const record = [
    stats.data?.bookedBy != null
      ? t('requests.inbox.bookedBy', { count: stats.data.bookedBy })
      : null,
    stats.data?.replied
      ? t('requests.inbox.replied', {
          replied: stats.data.replied.replied,
          asked: stats.data.replied.answered,
        })
      : null,
  ].filter(Boolean);

  return (
    <View style={[styles.card, p.status === 'accepted' && styles.cardChosen]}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('requests.inbox.openVendor', { vendor: name })}
        onPress={() => router.push({ pathname: '/v/[slug]', params: { slug: p.vendor.slug } })}
        style={styles.vendor}
      >
        <VendorThumb name={name} url={p.vendor.photoUrl} />
        <View style={styles.grow}>
          <AppText weight={700}>{name}</AppText>
          <AppText variant="label" weight={400} color="text2">
            {[p.vendor.city, p.vendor.foundingNumber ? t('requests.inbox.founding') : null]
              .filter(Boolean)
              .join(' · ')}
          </AppText>
        </View>
        <Icon name="chevron-forward" size={17} color={Colors.chevron} weight="semibold" />
      </PressableScale>

      {p.priceCents != null ? (
        <View style={styles.priceRow}>
          <AppText variant="title" style={styles.tabular}>
            {dollars(p.priceCents)}
          </AppText>
          {p.priceUnit && <AppText color="text2">{t(`requests.units.${p.priceUnit}`)}</AppText>}
          {lowest && (
            <View style={styles.lowest}>
              <AppText variant="caption" weight={700} color="success">
                {t('requests.inbox.lowest')}
              </AppText>
            </View>
          )}
        </View>
      ) : (
        <AppText weight={600} color="text2">
          {t('requests.inbox.priceInChat')}
        </AppText>
      )}

      {free.data === 'open' && (
        <View style={styles.attach}>
          <Icon name="checkmark-circle" size={18} color={Colors.success} />
          <AppText weight={600} color="success">
            {t('requests.inbox.freeOnDate')}
          </AppText>
        </View>
      )}

      <AppText>{p.note}</AppText>

      {(p.reelId || p.menuId) && (
        <View style={styles.attach}>
          <Icon
            name={p.reelId ? 'film-outline' : 'restaurant-outline'}
            size={18}
            color={Colors.primary}
          />
          <AppText weight={600} color="primary">
            {t(p.reelId ? 'requests.inbox.withReel' : 'requests.inbox.withMenu')}
          </AppText>
        </View>
      )}

      {record.length > 0 && (
        <AppText variant="label" weight={400} color="text2">
          {record.join(' · ')}
        </AppText>
      )}

      {p.status === 'accepted' ? (
        <View style={styles.actions}>
          <StatusPill tone="done">{t('requests.inbox.chosen')}</StatusPill>
          {p.conversationId && (
            <Button
              variant="secondary"
              icon="chatbubble-ellipses-outline"
              label={t('requests.inbox.openChat')}
              onPress={() =>
                router.push({ pathname: '/chat/[id]', params: { id: p.conversationId ?? '' } })
              }
            />
          )}
        </View>
      ) : p.status === 'declined' ? (
        <StatusPill tone="quiet">{t('requests.inbox.declined')}</StatusPill>
      ) : canAnswer ? (
        <View style={styles.actions}>
          <Button
            label={t('requests.inbox.accept')}
            onPress={() => onChoose(name)}
            disabled={busy}
            style={styles.grow}
          />
          <Button
            variant="secondary"
            label={t('requests.inbox.decline')}
            onPress={onDecline}
            disabled={busy}
            style={styles.grow}
          />
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  posted: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.successTint,
  },
  summary: {
    gap: Spacing.sm,
  },
  facts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Spacing.md,
  },
  waiting: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xl,
  },
  center: {
    textAlign: 'center',
  },
  card: {
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  cardChosen: {
    boxShadow: `inset 0 0 0 2px ${Colors.success}`,
  },
  vendor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    columnGap: Spacing.sm,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  lowest: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.chip,
    backgroundColor: Colors.successTint,
  },
  attach: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  grow: {
    flexGrow: 1,
  },
}));
