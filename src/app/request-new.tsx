import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Chip } from '@/components/chip';
import { FieldError } from '@/components/field-error';
import { groupIcon } from '@/components/group-icon';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { TextField } from '@/components/text-field';
import { makeStyles, Radius, Spacing, useColors, SchemeContext } from '@/constants/theme';
import { matchCities, useCities } from '@/data/places';
import { useCategories } from '@/data/reference';
import { useCategoryVendorCounts } from '@/data/vendors';
import { requestProblem, usePostRequest } from '@/data/requests';
import { useSession } from '@/features/auth/session';
import { StartPlanCard } from '@/features/planner/start-plan-card';
import { usePlanView } from '@/features/planner/use-plan-view';
import { GlassCard, GlowButton, NightScreen } from '@/features/requests/night';
import { SentMoment } from '@/features/requests/moments';
import { RequestInvite } from '@/features/requests/request-invite';
import { budgetBands, shortName } from '@/features/requests/requests-format';
import { useRequestWords } from '@/features/requests/use-request-words';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic, successHaptic } from '@/lib/haptics';

type Step = 0 | 1 | 2;

/**
 * Ask vendors (#219), in three steps on the night page: what you need (big
 * tiles for the event's vendor types), your budget and town, then a note
 * with the request shown as vendors will see it. The plan fills in the date
 * and guests. Sending plays the sent moment, then opens the request. Vendors see the
 * short name and town only, never a phone number or email.
 * /request-new?event=&category=
 */
export default function AskVendorsSheet() {
  return (
    <SchemeContext.Provider value="dark">
      <AskVendors />
    </SchemeContext.Provider>
  );
}

function AskVendors() {
  const Colors = useColors();
  const styles = useStyles();
  const { t, locale } = useLocale();
  const params = useLocalSearchParams<{ event?: string; category?: string }>();
  const { profile } = useSession();
  const view = usePlanView();
  const words = useRequestWords();
  const categories = useCategories();
  const cities = useCities();
  const vendorCounts = useCategoryVendorCounts();
  const post = usePostRequest(view.wedding?.id ?? '');

  const [step, setStep] = useState<Step>(params.category ? 1 : 0);
  const [picked, setEvent] = useState<string | null>(params.event ?? null);
  // Until they pick, the first event (the plan may still be loading at first)
  const event = picked ?? view.chosen[0]?.slug ?? null;
  const [category, setCategory] = useState<string | null>(params.category ?? null);
  const [budget, setBudget] = useState<string | null>(null);
  const [town, setTown] = useState(profile?.city ?? '');
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);

  const eventNeeds = (event ? (view.needsByEvent[event] ?? []) : []).flatMap((s) => s.needs);
  // No plan for this event yet: every vendor type, A to Z
  const needs =
    eventNeeds.length > 0
      ? eventNeeds
      : (categories.data ?? []).map((c) => ({
          categorySlug: c.slug,
          name: c.name,
          groupSlug: c.groupSlug,
        }));
  const group = category ? words.group(category) : null;
  const bands = budgetBands(group);
  const band = bands.find((b) => b.key === budget) ?? null;
  const date = (event && view.plan.eventDates?.[event]) || view.plan.weddingDate || null;
  const guestBand = (event && view.plan.guests?.[event]) || null;
  const place = matchCities(cities.data ?? [], town, 1)[0] ?? null;
  const name = shortName(profile?.full_name) || t('requests.post.you');
  const eventLabel = view.chosen.find((e) => e.slug === event);

  const draft = {
    categorySlug: category ?? '',
    eventSlug: event,
    eventDate: date,
    guestBand,
    budgetMinCents: band?.min != null ? band.min * 100 : null,
    budgetMaxCents: band?.max != null ? band.max * 100 : null,
  };

  const close = () => router.canGoBack() && router.back();

  if (!view.wedding && !view.loading) {
    return (
      <NightScreen
        top={<CloseButton onPress={close} />}
        title={t('requests.post.title')}
        subtitle={t('requests.post.needsPlan')}
      >
        <StartPlanCard />
      </NightScreen>
    );
  }

  const send = () => {
    if (!category || !place) return;
    post.mutate(
      { ...draft, categorySlug: category, note: note.trim(), citySlug: place.slug },
      {
        onSuccess: (id) => {
          successHaptic();
          setSent(true);
          setTimeout(
            () =>
              router.replace({
                pathname: '/request/[id]',
                params: { id: String(id), posted: '1' },
              }),
            2400,
          );
        },
      },
    );
  };

  const titles = [t('requests.post.step1'), t('requests.post.step2'), t('requests.post.step3')];

  const footer =
    step === 0 ? null : step === 1 ? (
      <GlowButton
        label={t('requests.post.continue')}
        icon="arrow-forward"
        disabled={!place}
        onPress={() => setStep(2)}
      />
    ) : (
      <GlowButton
        label={t('requests.post.send')}
        icon="paper-plane-outline"
        loading={post.isPending}
        onPress={send}
      />
    );

  return (
    <View style={styles.fill}>
      <NightScreen
        top={
          <View style={styles.topRow}>
            {step > 0 ? (
              <IconCircle
                icon="chevron-back"
                label={t('common.back')}
                onPress={() => setStep((step - 1) as Step)}
              />
            ) : (
              <View style={styles.spacer} />
            )}
            <Progress step={step} />
            <CloseButton onPress={close} />
          </View>
        }
        eyebrow={t('requests.post.stepOf', { step: step + 1, total: 3 })}
        title={titles[step]}
        subtitle={step === 0 ? t('requests.post.body') : undefined}
        footer={footer}
      >
        {step === 0 && (
          <>
            {view.chosen.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.eventRow}
              >
                {view.chosen.map((e) => (
                  <Chip
                    key={e.slug}
                    role="radio"
                    label={localized(e.name, locale)}
                    selected={event === e.slug}
                    onPress={() => {
                      setEvent(e.slug);
                      setCategory(null);
                    }}
                  />
                ))}
              </ScrollView>
            )}
            <View style={styles.grid}>
              {needs.map((need, i) => {
                const picked = category === need.categorySlug;
                return (
                  <Animated.View
                    key={need.categorySlug}
                    entering={FadeInDown.delay(Math.min(i, 12) * 40).duration(320)}
                    style={styles.tileWrap}
                  >
                    <PressableScale
                      accessibilityRole="radio"
                      accessibilityState={{ selected: picked }}
                      accessibilityLabel={localized(need.name, locale)}
                      onPress={() => {
                        selectionHaptic();
                        setCategory(need.categorySlug);
                        setBudget(null);
                        setStep(1);
                      }}
                      style={[styles.tile, picked && styles.tilePicked]}
                    >
                      <View style={styles.tileIcon}>
                        <Icon name={groupIcon(need.groupSlug)} size={26} color={Colors.champagne} />
                      </View>
                      <AppText weight={700} numberOfLines={3}>
                        {localized(need.name, locale)}
                      </AppText>
                      {(vendorCounts.data?.[need.categorySlug] ?? 0) > 0 && (
                        <AppText variant="label" weight={500} color="text2">
                          {t('requests.post.vendorCount', {
                            count: vendorCounts.data?.[need.categorySlug] ?? 0,
                          })}
                        </AppText>
                      )}
                    </PressableScale>
                  </Animated.View>
                );
              })}
            </View>
          </>
        )}

        {step === 1 && (
          <Animated.View entering={FadeInRight.duration(280)} style={styles.stack}>
            <AppText weight={600} color="text2">
              {t('requests.post.budget')}
            </AppText>
            {bands.map((b) => {
              const picked = budget === b.key;
              return (
                <Pressable
                  key={b.key}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: picked }}
                  onPress={() => {
                    selectionHaptic();
                    setBudget(picked ? null : b.key);
                  }}
                  style={({ pressed }) => [
                    styles.option,
                    picked && styles.optionPicked,
                    pressed && styles.pressed,
                  ]}
                >
                  <AppText variant="bodyLg" weight={600} style={styles.grow}>
                    {t(`requests.budget.bands.${b.key}`)}
                  </AppText>
                  <Icon
                    name={picked ? 'checkmark-circle' : 'ellipse-outline'}
                    size={26}
                    color={picked ? Colors.champagne : Colors.text2}
                  />
                </Pressable>
              );
            })}
            <AppText variant="label" weight={400} color="text2">
              {t('requests.post.budgetHint')}
            </AppText>
            <GlassCard>
              <TextField
                label={t('requests.post.town')}
                value={town}
                onChangeText={setTown}
                hint={place ? t('requests.post.townMatch', { city: place.name }) : undefined}
                error={town.trim() && !place ? t('requests.post.townError') : undefined}
                autoComplete="off"
              />
            </GlassCard>
          </Animated.View>
        )}

        {step === 2 && (
          <Animated.View entering={FadeInRight.duration(280)} style={styles.stack}>
            <TextField
              label={t('requests.post.note')}
              hint={t('requests.post.noteHint')}
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={600}
            />
            <AppText variant="label" weight={700} color="champagne">
              {t('requests.post.preview')}
            </AppText>
            <RequestInvite
              eventName={eventLabel ? localized(eventLabel.name, locale) : null}
              headline={category ? words.category(category) : ''}
              date={date}
              facts={words.facts(draft)}
              note={note.trim() || null}
              footer={
                <AppText variant="label" weight={400} color="text2">
                  {`${name} · ${place?.name ?? ''}`}
                </AppText>
              }
            />
            <View style={styles.privacy}>
              <Icon name="lock-closed" size={18} color={Colors.text2} />
              <AppText variant="label" weight={400} color="text2" style={styles.grow}>
                {t('requests.post.privacy', {
                  name,
                  city: place?.name ?? t('requests.post.yourTown'),
                })}
              </AppText>
            </View>
            {post.isError && (
              <FieldError message={t(`requests.problems.${requestProblem(post.error)}`)} />
            )}
          </Animated.View>
        )}
      </NightScreen>
      {sent && (
        <SentMoment
          title={t('requests.sent.title')}
          body={t('requests.sent.body', {
            category: category ? words.category(category) : '',
            city: place?.name ?? '',
          })}
        />
      )}
    </View>
  );
}

/** The three-part progress line, gold up to the current step. */
function Progress({ step }: { step: Step }) {
  const styles = useStyles();
  return (
    <View style={styles.progress} accessible={false}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.progressPart, i <= step && styles.progressOn]} />
      ))}
    </View>
  );
}

function CloseButton({ onPress }: { onPress: () => void }) {
  const { t } = useLocale();
  return <IconCircle icon="close" label={t('common.close')} onPress={onPress} />;
}

function IconCircle({
  icon,
  label,
  onPress,
}: {
  icon: 'close' | 'chevron-back';
  label: string;
  onPress: () => void;
}) {
  const Colors = useColors();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.circle, pressed && styles.pressed]}
    >
      <Icon name={icon} size={22} color={Colors.text} weight="semibold" />
    </Pressable>
  );
}

const useStyles = makeStyles((Colors) => ({
  fill: {
    flex: 1,
  },
  topRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  spacer: {
    width: 44,
  },
  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.nightCardStrong,
    borderWidth: 1,
    borderColor: Colors.nightLine,
  },
  progress: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  progressPart: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.nightLine,
  },
  progressOn: {
    backgroundColor: Colors.champagne,
  },
  eventRow: {
    gap: Spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  tileWrap: {
    flexGrow: 1,
    flexBasis: 150,
  },
  tile: {
    minHeight: 120,
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.nightCard,
    borderWidth: 1,
    borderColor: Colors.nightLine,
  },
  tilePicked: {
    borderColor: Colors.champagne,
    boxShadow: Colors.roseGlow,
  },
  tileIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.nightCardStrong,
  },
  stack: {
    gap: Spacing.md,
  },
  option: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: 22,
    borderCurve: 'continuous',
    backgroundColor: Colors.nightCard,
    borderWidth: 1,
    borderColor: Colors.nightLine,
  },
  optionPicked: {
    borderColor: Colors.champagne,
    backgroundColor: Colors.nightCardStrong,
  },
  privacy: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  grow: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
}));
