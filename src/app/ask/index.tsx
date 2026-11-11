import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { makeStyles, Sizes, Spacing, useColors } from '@/constants/theme';
import type { GuestBand } from '@/data/inquiries';
import { countForBand } from '@/features/onboarding/guest-count';
import {
  answersFromDetails,
  MAX_VISIT_DAYS,
  preselectEvents,
  setAsk,
  startAsk,
} from '@/features/inquiry/ask-draft';
import { shortDay } from '@/features/inquiry/ask-message';
import { likelyEvent } from '@/features/inquiry/ask-plan';
import { AskScreen } from '@/features/inquiry/ask-screen';
import { AskStep } from '@/features/inquiry/ask-step';
import { eventChips, GUEST_BANDS, toDateString } from '@/features/inquiry/inquiry-helpers';
import { useAsk } from '@/features/inquiry/use-ask';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';

type Params = {
  vendorId?: string;
  /** The event they came from (the date ticket, a reel). */
  event?: string;
  /** "tour": asking to visit a hall. */
  kind?: string;
  /** Ask again: last time's guest band, and answers (JSON). */
  guests?: string;
  answers?: string;
  /** Days picked on the vendor's page to visit, yyyy-mm-dd, comma separated. */
  visit?: string;
};

/** What the link brings, as the start of a fresh draft. */
function startFrom(params: Params) {
  const today = toDateString(new Date());
  let answers = {};
  try {
    answers = answersFromDetails(JSON.parse(params.answers ?? 'null'), today);
  } catch {
    // A broken link starts blank
  }
  const visitDays = (params.visit ?? '')
    .split(',')
    .filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day) && day >= today)
    .slice(0, MAX_VISIT_DAYS);
  const band = GUEST_BANDS.includes(params.guests as GuestBand)
    ? (params.guests as GuestBand)
    : null;
  return {
    vendorId: params.vendorId ?? '',
    tour: params.kind === 'tour' || visitDays.length > 0,
    eventSlugs: params.event ? [params.event] : [],
    ...(band && band !== 'not_sure' ? { guestCount: countForBand(band) } : {}),
    ...(band === 'not_sure' ? { guestsUnsure: true } : {}),
    ...answers,
    ...(visitDays.length > 0 ? { visitDays } : {}),
  };
}

/**
 * Ask for a quote, page 1 of 5: which of their events it's for. Their
 * events from My Wedding, each with its day and guests, the one this vendor
 * is for picked already; tap to add more, or Another event for the rest.
 * Opening it starts a fresh ask (`?vendorId=`, with `&event=`, `&kind=tour`,
 * `&visit=` days, or Ask again's `&guests=` and `&answers=`).
 */
export default function AskEventStep() {
  const params = useLocalSearchParams<Params>();
  // A fresh draft each time Ask opens
  useState(() => {
    startAsk(startFrom(params));
    return true;
  });
  const ask = useAsk();
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const { draft, v, view, allEvents } = ask;
  const [showAll, setShowAll] = useState(false);
  const guessed = useRef(false);

  const likely = v
    ? likelyEvent(view.chosen, view.needsByEvent, v.categorySlugs, view.plan.guests, params.event)
    : null;

  // Once the vendor and plan are in, start with the event this vendor is for
  useEffect(() => {
    if (guessed.current || !v || view.isPending || view.loading) return;
    guessed.current = true;
    if (draft.eventSlugs.length === 0 && likely) preselectEvents([likely]);
  }, [v, view.isPending, view.loading, likely, draft.eventSlugs.length]);

  const choosable = allEvents.filter((event) => event.phase !== 'whole_wedding');
  const fromPlan = view.chosen.length > 0;
  const planned = fromPlan
    ? choosable.filter((event) => view.chosen.some((c) => c.slug === event.slug))
    : eventChips(choosable, params.event ? [params.event] : [], v?.eventSlugs ?? [], showAll).shown;
  // Anything picked stays in view, even when it isn't in their plan
  const shown = [
    ...choosable.filter(
      (event) =>
        draft.eventSlugs.includes(event.slug) && !planned.some((p) => p.slug === event.slug),
    ),
    ...planned,
    ...(fromPlan && showAll
      ? choosable.filter(
          (event) =>
            !planned.some((p) => p.slug === event.slug) && !draft.eventSlugs.includes(event.slug),
        )
      : []),
  ];
  const hasMore = !showAll && choosable.length > shown.length;

  const toggle = (slug: string) =>
    setAsk({
      eventSlugs: draft.eventSlugs.includes(slug)
        ? draft.eventSlugs.filter((other) => other !== slug)
        : [...draft.eventSlugs, slug],
    });

  const picked = shown.filter((event) => draft.eventSlugs.includes(event.slug));
  const summary =
    picked.length === 0
      ? t('ask.event.summaryNone')
      : picked.length === 1
        ? localized(picked[0].name)
        : t('ask.event.summaryMany', { number: picked.length });

  return (
    <AskScreen ask={ask}>
      <AskStep
        step={1}
        heading={ask.heading}
        photo={ask.photo}
        title={t('ask.event.title')}
        subtitle={t(fromPlan ? 'ask.event.subtitle' : 'ask.event.subtitleNoPlan')}
        summary={summary}
        onClose={ask.leave}
        onContinue={() => router.push('/ask/when')}
      >
        <View>
          {shown.map((event, index) => {
            const on = draft.eventSlugs.includes(event.slug);
            const day = view.plan.eventDates?.[event.slug];
            const band = view.plan.guests?.[event.slug];
            const facts = [
              day ? shortDay(day) : null,
              band && GUEST_BANDS.includes(band as GuestBand) && band !== 'not_sure'
                ? t('ask.event.guests', { band: t(`inquiry.guestBands.${band}`) })
                : null,
            ]
              .filter(Boolean)
              .join(' · ');
            const name = localized(event.name);
            return (
              <Pressable
                key={event.slug}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={[
                  name,
                  facts,
                  event.slug === likely ? t('ask.event.suggested') : null,
                ]
                  .filter(Boolean)
                  .join(', ')}
                onPress={() => {
                  selectionHaptic();
                  toggle(event.slug);
                }}
                style={({ pressed }) => [
                  styles.row,
                  index > 0 && styles.divider,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.words}>
                  <View style={styles.nameLine}>
                    <AppText variant="bodyLg" weight={on ? 700 : 500} style={styles.shrink}>
                      {name}
                    </AppText>
                    {event.slug === likely && (
                      <View style={styles.tag}>
                        <AppText variant="caption" weight={700} color="success" style={styles.caps}>
                          {t('ask.event.suggested').toUpperCase()}
                        </AppText>
                      </View>
                    )}
                  </View>
                  {facts.length > 0 && (
                    <AppText variant="label" color="text2">
                      {facts}
                    </AppText>
                  )}
                </View>
                <View style={[styles.mark, on && styles.markOn]}>
                  {on && <Icon name="checkmark" size={15} color={Colors.onPrimary} weight="bold" />}
                </View>
              </Pressable>
            );
          })}
          {hasMore && (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                selectionHaptic();
                setShowAll(true);
              }}
              style={({ pressed }) => [styles.more, styles.divider, pressed && styles.pressed]}
            >
              <Icon name="add" size={20} color={Colors.text2} />
              <AppText weight={600} color="text2">
                {t('ask.event.another')}
              </AppText>
            </Pressable>
          )}
        </View>
      </AskStep>
    </AskScreen>
  );
}

const MARK = 28;

const useStyles = makeStyles((Colors) => ({
  row: {
    minHeight: Sizes.row + 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  pressed: {
    opacity: 0.6,
  },
  words: {
    flex: 1,
    gap: 2,
  },
  nameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  shrink: {
    flexShrink: 1,
  },
  tag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: Colors.successTint,
  },
  caps: {
    letterSpacing: 0.5,
  },
  mark: {
    width: MARK,
    height: MARK,
    borderRadius: MARK / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.separator,
  },
  markOn: {
    borderColor: Colors.primaryFill,
    backgroundColor: Colors.primaryFill,
  },
  more: {
    minHeight: Sizes.tapTarget + 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
}));
