import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { CheckCircle } from '@/components/check-circle';
import { Chip } from '@/components/chip';
import { DateField } from '@/components/date-field';
import { groupIcon } from '@/components/group-icon';
import { Icon } from '@/components/icon';
import { VaultIcon } from '@/components/vault-icon';
import { makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import type { EventNeed, EventNeedsSection, TraditionEvent } from '@/data/reference';
import { formatDate, GUEST_BANDS } from '@/features/inquiry/inquiry-helpers';
import { AskWedButton } from '@/features/wed/ask-wed-button';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic, successHaptic } from '@/lib/haptics';
import { Motion } from '@/lib/motion';

import { EventTicket } from './event-ticket';
import { findForPlan } from './find-for-plan';
import { essentialNeeds } from './plan';
import { bookedNames, bookedText, stillNeedsText, unbookedNames } from './still-needs';

type BookedVendors = Record<string, { slug: string; name: string }>;

/** One event: its ticket, and below it, once opened, its date, guests and what to book. */
export function EventPlan({
  event,
  sections,
  booked,
  bookedVendors,
  suggested,
  guests,
  date,
  weddingDate,
  when,
  coming,
  canEdit,
  open,
  onToggle,
  onComplete,
  onToggleBooked,
  onGuests,
  onDate,
  vault,
}: {
  event: TraditionEvent;
  sections: EventNeedsSection[];
  booked: string[];
  bookedVendors: BookedVendors;
  /** Open suggestions per "event/category". */
  suggested: Record<string, number>;
  guests: string | null;
  /** This event's own day, yyyy-mm-dd; it goes into requests to vendors. */
  date: string | null;
  /** The wedding's date, on the ticket's stub until the event has its own. */
  weddingDate: string | null;
  /** When it starts and where, as the family typed it for guests. */
  when: string | null;
  /** How many are coming, from the RSVPs. */
  coming: string | null;
  canEdit: boolean;
  open: boolean;
  onToggle: () => void;
  /** Its last essential was just booked. */
  onComplete: () => void;
  onToggleBooked: (categorySlug: string) => void;
  onGuests: (band: string | null) => void;
  onDate: (date: string | null) => void;
  /** The wedding's Memory Vault once it's open, and how many photos and videos are from this event. */
  vault: { id: string; count: number } | null;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const [showNice, setShowNice] = useState(false);
  const essential = essentialNeeds(sections);
  const extras = sections.filter((s) => s.importance !== 'essential').flatMap((s) => s.needs);
  const done = essential.filter((need) => booked.includes(need.categorySlug)).length;
  const complete = essential.length > 0 && done === essential.length;
  const name = localized(event.name);
  // In words, not "0/6" (the final look, 2026-10-23)
  const stillNeeds = stillNeedsText(unbookedNames(essential, booked), t);
  const bookedLine = bookedText(
    bookedNames(
      [...essential, ...extras],
      booked,
      (category) => bookedVendors[`${event.slug}/${category}`]?.name ?? null,
    ),
    t,
  );
  // Before it has its own day, when it usually happens ("The night before")
  const whenShown = when ?? (!date && event.timing ? localized(event.timing) : null);

  const wasComplete = useRef(complete);
  useEffect(() => {
    if (complete && !wasComplete.current) onComplete();
    wasComplete.current = complete;
  }, [complete, onComplete]);

  const row = (need: EventNeed, isEssential: boolean) => (
    <NeedRow
      key={need.categorySlug}
      need={need}
      eventSlug={event.slug}
      booked={booked.includes(need.categorySlug)}
      bookedWith={bookedVendors[`${event.slug}/${need.categorySlug}`]?.name ?? null}
      suggested={suggested[`${event.slug}/${need.categorySlug}`] ?? 0}
      guests={guests}
      essential={isEssential}
      canEdit={canEdit}
      onToggle={() => onToggleBooked(need.categorySlug)}
    />
  );

  return (
    // The tickets fade in together, 200 ms
    <Animated.View entering={Motion.enter} layout={Motion.layout} style={styles.event}>
      <EventTicket
        slug={event.slug}
        name={name}
        date={date ?? weddingDate}
        when={whenShown}
        stillNeeds={stillNeeds}
        complete={complete}
        booked={bookedLine}
        coming={coming}
        open={open}
        onPress={() => {
          selectionHaptic();
          onToggle();
        }}
        accessibilityLabel={[
          name,
          date ? formatDate(date) : null,
          whenShown,
          stillNeeds,
          bookedLine,
          coming,
        ]
          .filter(Boolean)
          .join(', ')}
      />

      {open && (
        <Animated.View entering={Motion.enter} exiting={Motion.exit} style={styles.panel}>
          <View style={[styles.guests, styles.firstSection]}>
            <AppText variant="label" weight={600} color="text2">
              {t('planner.eventDateTitle', { event: name })}
            </AppText>
            {canEdit ? (
              <>
                <DateField
                  value={date}
                  onChange={(picked) => {
                    selectionHaptic();
                    onDate(picked);
                  }}
                  placeholder={date ? formatDate(date) : t('planner.eventDatePick')}
                />
                {date && (
                  <Button
                    variant="text"
                    label={t('planner.eventDateClear')}
                    onPress={() => onDate(null)}
                  />
                )}
              </>
            ) : (
              <AppText weight={600}>{date ? formatDate(date) : t('planner.eventDateNone')}</AppText>
            )}
            <AppText variant="caption" color="text2">
              {t('planner.eventDateHint')}
            </AppText>
            {/* The start time and place live with what guests see (Invitation details) */}
            {canEdit && (
              <Button
                variant="text"
                icon="time-outline"
                label={t('planner.ticket.timePlace')}
                onPress={() => router.push('/guest-details')}
              />
            )}
          </View>
          <View style={styles.guests}>
            <AppText variant="label" weight={600} color="text2">
              {t('planner.guestsTitle')}
            </AppText>
            <View style={styles.guestChips} accessibilityRole="radiogroup">
              {GUEST_BANDS.map((band) => (
                <Chip
                  key={band}
                  role="radio"
                  label={t(`inquiry.guestBands.${band}`)}
                  selected={guests === band}
                  disabled={!canEdit}
                  onPress={() => onGuests(guests === band ? null : band)}
                />
              ))}
            </View>
          </View>
          {essential.map((need) => row(need, true))}
          {extras.length > 0 && showNice && (
            <Animated.View entering={Motion.enter} exiting={Motion.exit}>
              <AppText variant="label" weight={600} color="text2" style={styles.subhead}>
                {t('event.niceToHave')}
              </AppText>
              {extras.map((need) => row(need, false))}
            </Animated.View>
          )}
          {extras.length > 0 && (
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowNice((shown) => !shown)}
              style={({ pressed }) => [styles.more, pressed && styles.headPressed]}
            >
              <AppText weight={600} color="primary">
                {showNice ? t('planner.showLess') : t('planner.showNice', { count: extras.length })}
              </AppText>
              <Icon
                name={showNice ? 'chevron-up' : 'chevron-down'}
                size={15}
                color={Colors.primary}
                weight="semibold"
              />
            </Pressable>
          )}
          {/* Wed (mockup): hand the rest of this event's essentials to Wed. */}
          {done < essential.length && (
            <View style={styles.wedRow}>
              <AskWedButton
                variant="row"
                label={`Let Wed find the rest for the ${event.name.en}`}
                about={{ kind: 'event', id: event.slug, label: event.name.en }}
                ask={`Find the vendors we still need for the ${event.name.en}`}
              />
            </View>
          )}
          {canEdit && (
            <Pressable
              accessibilityRole="button"
              accessibilityHint={t('requests.post.hint')}
              onPress={() =>
                router.push({ pathname: '/request-new', params: { event: event.slug } })
              }
              style={({ pressed }) => [styles.more, pressed && styles.headPressed]}
            >
              <Icon name="megaphone-outline" size={17} color={Colors.primary} />
              <AppText weight={600} color="primary">
                {t('requests.post.fromPlan')}
              </AppText>
            </Pressable>
          )}
          {vault && (
            <Pressable
              accessibilityRole="link"
              onPress={() =>
                router.push({
                  pathname: '/vault/[id]',
                  params: { id: vault.id, event: event.slug },
                })
              }
              style={({ pressed }) => [styles.more, pressed && styles.headPressed]}
            >
              <VaultIcon size={17} color={Colors.primary} />
              <AppText weight={600} color="primary">
                {t('memoryVault.eventRow', { count: vault.count })}
              </AppText>
            </Pressable>
          )}
        </Animated.View>
      )}
    </Animated.View>
  );
}

/** A vendor type to book: tick when booked, Find to look for one. */
function NeedRow({
  need,
  eventSlug,
  booked,
  bookedWith,
  suggested,
  guests,
  essential,
  canEdit,
  onToggle,
}: {
  need: EventNeed;
  eventSlug: string;
  booked: boolean;
  /** The vendor's name, when the booking names one. */
  bookedWith: string | null;
  /** Open suggestions for it, waiting for the family to decide. */
  suggested: number;
  /** The event's guest band, which Find turns into filters. */
  guests: string | null;
  essential: boolean;
  canEdit: boolean;
  onToggle: () => void;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const name = localized(need.name);

  return (
    <Animated.View layout={Motion.layout} style={styles.need}>
      <CheckCircle
        checked={booked}
        disabled={!canEdit}
        accessibilityLabel={t('planner.markBooked', { name })}
        onPress={() => {
          if (booked) selectionHaptic();
          else successHaptic();
          onToggle();
        }}
      />
      <Icon
        name={groupIcon(need.groupSlug)}
        size={20}
        color={booked ? Colors.textDisabled : Colors.primary}
      />
      <View style={styles.grow}>
        <AppText color={booked ? 'text2' : 'text'} style={booked && styles.doneText}>
          {name}
        </AppText>
        {booked && bookedWith && (
          <AppText variant="caption" color="success" weight={600}>
            {t('planner.bookedWith', { name: bookedWith })}
          </AppText>
        )}
        {essential && !booked && (
          <AppText variant="caption" color="kesari" weight={600}>
            {t('event.essential')}
          </AppText>
        )}
        {suggested > 0 && (
          <AppText variant="caption" color="primary" weight={600}>
            {t('suggestions.openCount', { count: suggested })}
          </AppText>
        )}
      </View>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={t('planner.find', { name })}
        hitSlop={6}
        onPress={() => findForPlan(need.categorySlug, need.groupSlug, eventSlug, guests)}
        style={({ pressed }) => [styles.find, pressed && styles.findPressed]}
      >
        <AppText variant="label" weight={600} color="primary">
          {t('planner.findShort')}
        </AppText>
      </Pressable>
    </Animated.View>
  );
}

const useStyles = makeStyles((Colors) => ({
  // A ticket, and its opened details just under it
  event: {
    gap: Spacing.sm,
  },
  panel: {
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  headPressed: {
    backgroundColor: Colors.rowPressed,
  },
  grow: {
    flex: 1,
    gap: 2,
  },
  guests: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
  },
  firstSection: {
    borderTopWidth: 0,
    paddingTop: Spacing.lg,
  },
  guestChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  subhead: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
  },
  more: {
    minHeight: Sizes.tapTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
  },
  need: {
    minHeight: Sizes.row,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
  },
  doneText: {
    textDecorationLine: 'line-through',
  },
  find: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.button,
    backgroundColor: Colors.primaryTint,
  },
  findPressed: {
    opacity: 0.6,
  },
  wedRow: {
    paddingHorizontal: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
  },
}));
