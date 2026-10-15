import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Icon, type IconName } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { StateView } from '@/components/state-view';
import {
  backgroundCss,
  makeStyles,
  Radius,
  Sizes,
  Spacing,
  useColors,
  type ColorToken,
  SchemeContext,
} from '@/constants/theme';
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
import { useSession } from '@/features/auth/session';
import { usePlanView } from '@/features/planner/use-plan-view';
import { FaceStack, GlassCard, GlowButton, NightScreen } from '@/features/requests/night';
import { MatchMoment } from '@/features/requests/moments';
import { RequestInvite } from '@/features/requests/request-invite';
import { shortName } from '@/features/requests/requests-format';
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
 * One request and its proposals (#219), on the night page: the request as an
 * invitation with the faces of the vendors who answered, then the proposals
 * as a deck of tall cards to swipe through (the chosen one first, then the
 * lowest price). Choose plays the match moment, then opens the chat.
 * /request/{id}
 */
export default function RequestScreen() {
  return (
    <SchemeContext.Provider value="dark">
      <Request />
    </SchemeContext.Provider>
  );
}

function Request() {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const { width } = useWindowDimensions();
  const { id = '', posted } = useLocalSearchParams<{ id: string; posted?: string }>();
  const view = usePlanView();
  const weddingId = view.wedding?.id ?? '';
  const requests = useMyRequests(weddingId);
  const proposals = useRequestProposals(id);
  const answer = useAnswerProposal(id);
  const close = useCloseRequest(weddingId);
  const words = useRequestWords();
  const [match, setMatch] = useState<{ name: string; photo: string | null } | null>(null);
  const { profile } = useSession();
  const [page, setPage] = useState(0);
  const request = requests.data?.find((r) => r.id === id);

  if (requests.isPending || view.loading) {
    return (
      <NightScreen>
        <StateView state="loading" />
      </NightScreen>
    );
  }
  if (!request) {
    return (
      <NightScreen>
        <StateView state="empty" icon="megaphone-outline" message={t('requests.gone')} />
      </NightScreen>
    );
  }

  const live = (proposals.data ?? []).filter((p) => p.status !== 'withdrawn');
  const sorted = [...live].sort(
    (a, b) =>
      Number(b.status === 'accepted') - Number(a.status === 'accepted') ||
      (a.priceCents ?? Infinity) - (b.priceCents ?? Infinity),
  );
  const prices = live.map((p) => p.priceCents).filter((c): c is number => c != null);
  const lowest = prices.length > 1 ? Math.min(...prices) : null;
  const open = request.status === 'open' && !request.expired;
  const event = view.chosen.find((e) => e.slug === request.eventSlug);
  // Each card fills most of the screen, the next one peeking in
  const cardWidth = Math.min(width - Sizes.pageGutter * 2 - 28, 420);

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
              setMatch({ name: vendorName, photo: p.vendor.photoUrl });
              setTimeout(() => {
                setMatch(null);
                if (conversationId) {
                  router.push({ pathname: '/chat/[id]', params: { id: conversationId } });
                }
              }, 2600);
            },
          },
        ),
    );

  const status = request.expired && request.status === 'open' ? 'expired' : request.status;
  const facesFrom = live.map((p) => ({
    name: localized(p.vendor.name),
    photoUrl: p.vendor.photoUrl,
  }));

  return (
    <View style={styles.fill}>
      <NightScreen
        eyebrow={
          posted === '1'
            ? t('requests.inbox.postedShort')
            : t(`requests.status.${status}`).toUpperCase()
        }
        title={live.length > 0 ? t('requests.inbox.title', { count: live.length }) : undefined}
      >
        <RequestInvite
          eventName={event ? localized(event.name) : null}
          headline={words.category(request.categorySlug)}
          date={request.eventDate}
          facts={words.facts(request)}
          note={request.note || null}
          footer={
            live.length > 0 ? (
              <View style={styles.facesRow}>
                <FaceStack people={facesFrom} />
                <AppText weight={600} style={styles.grow}>
                  {t('requests.mine.proposals', { count: live.length })}
                </AppText>
              </View>
            ) : (
              <View style={styles.facesRow}>
                <Icon name="time-outline" size={20} color={Colors.text2} />
                <AppText color="text2" style={styles.grow}>
                  {t('requests.inbox.none')}
                </AppText>
              </View>
            )
          }
        />

        {sorted.length > 0 && (
          <>
            <ScrollView
              horizontal
              decelerationRate="fast"
              snapToInterval={cardWidth + Spacing.md}
              snapToAlignment="start"
              disableIntervalMomentum
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.deck}
              style={styles.deckOuter}
              onScroll={(e) =>
                setPage(Math.round(e.nativeEvent.contentOffset.x / (cardWidth + Spacing.md)))
              }
              scrollEventThrottle={64}
            >
              {sorted.map((p, i) => (
                <Animated.View key={p.id} entering={Motion.stagger(i)} style={{ width: cardWidth }}>
                  <ProposalCard
                    proposal={p}
                    eventDate={request.eventDate}
                    lowest={p.priceCents != null && p.priceCents === lowest}
                    canAnswer={open && p.status === 'sent'}
                    busy={answer.isPending}
                    onChoose={(name) => choose(p, name)}
                    onDecline={() => answer.mutate({ proposalId: p.id, accept: false })}
                  />
                </Animated.View>
              ))}
            </ScrollView>
            {sorted.length > 1 && (
              <View style={styles.dots} accessible={false}>
                {sorted.map((p, i) => (
                  <View key={p.id} style={[styles.dot, i === page && styles.dotOn]} />
                ))}
              </View>
            )}
          </>
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
      </NightScreen>
      {match && (
        <MatchMoment
          familyName={shortName(profile?.full_name) || t('requests.post.you')}
          vendorName={match.name}
          vendorPhoto={match.photo}
          title={t('requests.match.title', { vendor: match.name })}
          body={t('requests.match.body')}
        />
      )}
    </View>
  );
}

/** A small pill under the price: lowest, free that day, founding. */
function Tag({ icon, color, children }: { icon: IconName; color: ColorToken; children: string }) {
  const Colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.tag}>
      <Icon name={icon} size={15} color={Colors[color]} />
      <AppText variant="label" weight={700} color={color}>
        {children}
      </AppText>
    </View>
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
  const chosen = p.status === 'accepted';

  return (
    <GlassCard strong style={[styles.card, chosen && styles.cardChosen]}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('requests.inbox.openVendor', { vendor: name })}
        onPress={() => router.push({ pathname: '/v/[slug]', params: { slug: p.vendor.slug } })}
        style={styles.photo}
      >
        {p.vendor.photoUrl ? (
          <Image
            source={{ uri: p.vendor.photoUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.photoEmpty]}>
            <AppText serif weight={600} style={styles.initial} maxFontSizeMultiplier={1}>
              {name.trim()[0]?.toUpperCase() ?? ''}
            </AppText>
          </View>
        )}
        <View style={[StyleSheet.absoluteFill, styles.scrim]} />
        <View style={styles.photoWords}>
          <AppText variant="heading" weight={700} color="onHero" numberOfLines={2}>
            {name}
          </AppText>
          <AppText variant="label" weight={500} color="onHero2">
            {p.vendor.city}
          </AppText>
        </View>
      </PressableScale>

      <View style={styles.body}>
        {p.priceCents != null ? (
          <View style={styles.priceRow}>
            <AppText serif weight={600} style={styles.price} maxFontSizeMultiplier={1.4}>
              {dollars(p.priceCents)}
            </AppText>
            {p.priceUnit && <AppText color="text2">{t(`requests.units.${p.priceUnit}`)}</AppText>}
          </View>
        ) : (
          <AppText variant="heading" color="text2">
            {t('requests.inbox.priceInChat')}
          </AppText>
        )}

        <View style={styles.tags}>
          {chosen && (
            <Tag icon="checkmark-circle" color="success">
              {t('requests.inbox.chosen')}
            </Tag>
          )}
          {lowest && (
            <Tag icon="arrow-down" color="success">
              {t('requests.inbox.lowest')}
            </Tag>
          )}
          {free.data === 'open' && (
            <Tag icon="calendar-outline" color="success">
              {t('requests.inbox.freeOnDate')}
            </Tag>
          )}
          {p.vendor.foundingNumber != null && (
            <Tag icon="ribbon-outline" color="champagne">
              {t('requests.inbox.founding')}
            </Tag>
          )}
        </View>

        <AppText>{p.note}</AppText>

        {(p.reelId || p.menuId) && (
          <View style={styles.attach}>
            <Icon
              name={p.reelId ? 'film-outline' : 'restaurant-outline'}
              size={18}
              color={Colors.champagne}
            />
            <AppText weight={600} color="champagne">
              {t(p.reelId ? 'requests.inbox.withReel' : 'requests.inbox.withMenu')}
            </AppText>
          </View>
        )}

        {record.length > 0 && (
          <AppText variant="label" weight={400} color="text2">
            {record.join(' · ')}
          </AppText>
        )}

        {chosen && p.conversationId ? (
          <GlowButton
            glass
            icon="chatbubble-ellipses-outline"
            label={t('requests.inbox.openChat')}
            onPress={() =>
              router.push({ pathname: '/chat/[id]', params: { id: p.conversationId ?? '' } })
            }
          />
        ) : p.status === 'declined' ? (
          <AppText color="text2">{t('requests.inbox.declined')}</AppText>
        ) : canAnswer ? (
          <View style={styles.actions}>
            <GlowButton
              label={t('requests.inbox.accept')}
              icon="heart"
              loading={busy}
              onPress={() => onChoose(name)}
            />
            <GlowButton
              glass
              label={t('requests.inbox.decline')}
              disabled={busy}
              onPress={onDecline}
            />
          </View>
        ) : null}
      </View>
    </GlassCard>
  );
}

const useStyles = makeStyles((Colors) => ({
  fill: {
    flex: 1,
  },
  grow: {
    flex: 1,
  },
  facesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.nightLine,
  },
  deckOuter: {
    marginHorizontal: -Sizes.pageGutter,
  },
  deck: {
    gap: Spacing.md,
    paddingHorizontal: Sizes.pageGutter,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.nightLine,
  },
  dotOn: {
    width: 18,
    backgroundColor: Colors.champagne,
  },
  card: {
    padding: 0,
    gap: 0,
    overflow: 'hidden',
  },
  cardChosen: {
    borderColor: Colors.success,
  },
  photo: {
    height: 180,
    justifyContent: 'flex-end',
  },
  photoEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    ...backgroundCss(`linear-gradient(135deg, ${Colors.heroFrom} 0%, ${Colors.heroTo} 100%)`),
  },
  initial: {
    fontSize: 72,
    lineHeight: 84,
    color: 'rgba(255,255,255,0.35)',
  },
  scrim: {
    ...backgroundCss('linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 65%)'),
  },
  photoWords: {
    padding: Spacing.lg,
    gap: 2,
  },
  body: {
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    columnGap: Spacing.sm,
  },
  price: {
    fontSize: 46,
    lineHeight: 54,
    fontVariant: ['tabular-nums'],
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: Radius.chip,
    backgroundColor: Colors.nightCardStrong,
  },
  attach: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  actions: {
    gap: Spacing.sm,
  },
}));
