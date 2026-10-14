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
import { usePlanView } from '@/features/planner/use-plan-view';
import { StatusPill, VendorThumb } from '@/features/requests/request-parts';
import {
  type Proposal,
  useAnswerProposal,
  useCloseRequest,
  useMyRequests,
  useRequestProposals,
} from '@/features/requests/requests-source';
import { useRequestWords } from '@/features/requests/use-request-words';
import { useLocale } from '@/i18n/locale-context';
import { Motion } from '@/lib/motion';
import { successHaptic } from '@/lib/haptics';

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
 * vendor's price, note and record, lowest price first, to compare. Accept
 * opens a chat with that vendor; Decline says no thanks. Close the request
 * when they're done. /request/{id}
 */
export default function RequestScreen() {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const { id = '', posted } = useLocalSearchParams<{ id: string; posted?: string }>();
  const view = usePlanView();
  const requests = useMyRequests(view.wedding?.id ?? null);
  const proposals = useRequestProposals(id);
  const answer = useAnswerProposal(id);
  const close = useCloseRequest();
  const words = useRequestWords();
  const request = requests.data?.find((r) => r.id === id);

  if (requests.isPending) return <StateView state="loading" />;
  if (!request) {
    return <StateView state="empty" icon="megaphone-outline" message={t('requests.gone')} />;
  }

  const live = (proposals.data ?? []).filter((p) => p.status !== 'withdrawn');
  const sorted = [...live].sort((a, b) => a.priceCents - b.priceCents);
  const lowest = sorted[0]?.priceCents;
  const open = request.status === 'open';

  const accept = (p: Proposal) =>
    ask(
      t('requests.inbox.acceptTitle'),
      t('requests.inbox.acceptBody', { vendor: p.vendor.name, price: dollars(p.priceCents) }),
      t('requests.inbox.accept'),
      t('requests.inbox.notYet'),
      () =>
        answer.mutate(
          { proposalId: p.id, answer: 'accept' },
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
          {t(`requests.status.${request.status}`)}
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
            lowest={p.priceCents === lowest && sorted.length > 1}
            canAnswer={open && p.status === 'sent'}
            busy={answer.isPending}
            onAccept={() => accept(p)}
            onDecline={() => answer.mutate({ proposalId: p.id, answer: 'decline' })}
          />
        ))
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
              () => close.mutate(request.id),
            )
          }
        />
      )}
    </NavScreen>
  );
}

function ProposalCard({
  proposal: p,
  lowest,
  canAnswer,
  busy,
  onAccept,
  onDecline,
}: {
  proposal: Proposal;
  lowest: boolean;
  canAnswer: boolean;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const record = [
    p.vendor.bookedBy != null ? t('requests.inbox.bookedBy', { count: p.vendor.bookedBy }) : null,
    p.vendor.repliedTo
      ? t('requests.inbox.replied', {
          replied: p.vendor.repliedTo.replied,
          asked: p.vendor.repliedTo.asked,
        })
      : null,
  ].filter(Boolean);

  return (
    <View style={[styles.card, p.status === 'accepted' && styles.cardChosen]}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('requests.inbox.openVendor', { vendor: p.vendor.name })}
        onPress={() => router.push({ pathname: '/v/[slug]', params: { slug: p.vendor.slug } })}
        style={styles.vendor}
      >
        <VendorThumb name={p.vendor.name} url={p.vendor.coverUrl} />
        <View style={styles.grow}>
          <AppText weight={700}>{p.vendor.name}</AppText>
          <AppText variant="label" weight={400} color="text2">
            {[p.vendor.city, p.vendor.foundingNumber ? t('requests.inbox.founding') : null]
              .filter(Boolean)
              .join(' · ')}
          </AppText>
        </View>
        <Icon name="chevron-forward" size={17} color={Colors.chevron} weight="semibold" />
      </PressableScale>

      <View style={styles.priceRow}>
        <AppText variant="title" style={styles.tabular}>
          {dollars(p.priceCents)}
        </AppText>
        <AppText color="text2">{t(`requests.units.${p.unit}`)}</AppText>
        {lowest && (
          <View style={styles.lowest}>
            <AppText variant="caption" weight={700} color="success">
              {t('requests.inbox.lowest')}
            </AppText>
          </View>
        )}
      </View>

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
        <StatusPill tone="done">{t('requests.inbox.chosen')}</StatusPill>
      ) : p.status === 'declined' ? (
        <StatusPill tone="quiet">{t('requests.inbox.declined')}</StatusPill>
      ) : canAnswer ? (
        <View style={styles.actions}>
          <Button
            label={t('requests.inbox.accept')}
            onPress={onAccept}
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
    gap: Spacing.sm,
  },
  grow: {
    flexGrow: 1,
  },
}));
