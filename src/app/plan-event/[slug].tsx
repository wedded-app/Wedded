import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { BottomSheet } from '@/components/bottom-sheet';
import { Icon } from '@/components/icon';
import { ListRow, ListSection, SectionTitle } from '@/components/list';
import { NavScreen } from '@/components/nav';
import { StateView } from '@/components/state-view';
import { VaultIcon } from '@/components/vault-icon';
import { makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import { useGuestSummary } from '@/data/guests';
import { useMemoryVault } from '@/data/memory-vault';
import { openCounts, useWeddingSuggestions } from '@/data/wedding-suggestions';
import { GUEST_BANDS } from '@/features/inquiry/inquiry-helpers';
import { DaySheet } from '@/features/planner/day-sheet';
import { longDate } from '@/features/planner/day-list';
import { groupOf, setDay } from '@/features/planner/days';
import { NeedTile } from '@/features/planner/need-tile';
import { bookedVenueName } from '@/features/planner/place';
import { PlaceSheet } from '@/features/planner/place-sheet';
import { essentialNeeds } from '@/features/planner/plan';
import { stillNeedsText, unbookedNames } from '@/features/planner/still-needs';
import { usePlanDays } from '@/features/planner/use-plan-days';
import { usePlanView } from '@/features/planner/use-plan-view';
import { comingLine, whenLine } from '@/features/planner/wedding-tab';
import { AskWedButton } from '@/features/wed/ask-wed-button';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic, successHaptic } from '@/lib/haptics';
import { Motion } from '@/lib/motion';

/** How wide a nice-to-have tile is in its sideways row. */
const SIDE_TILE = 160;

/**
 * One event of the wedding on its own page, opened from its card on the
 * Wedding tab (or Home): what it still needs in a line, then its day, time
 * and place, and guests as three rows, each opening a small sheet for just
 * this event (the place is Home or a venue); the essentials as tiles two across
 * (tap to find one, tick to mark it booked); the nice-to-haves in a row
 * that scrolls sideways, so the page stays short; and Wed, a request to
 * vendors and the event's photos at the end. Booking the last essential
 * says so at the top.
 */
export default function PlanEventScreen() {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const { slug = '' } = useLocalSearchParams<{ slug: string }>();
  const view = usePlanView();
  const days = usePlanDays(view);
  const { plan, wedding, canEdit, chosen, needsByEvent } = view;
  const event = chosen.find((e) => e.slug === slug);
  const suggestions = useWeddingSuggestions(wedding?.id ?? null);
  const suggested = openCounts(suggestions.data ?? []);
  const guestSummary = useGuestSummary(canEdit ? (wedding?.id ?? null) : null);
  const vault = useMemoryVault(wedding?.id ?? null);
  const [sheet, setSheet] = useState<'day' | 'place' | 'guests' | null>(null);

  const sections = needsByEvent[slug] ?? [];
  const essential = essentialNeeds(sections);
  const extras = sections.filter((s) => s.importance !== 'essential').flatMap((s) => s.needs);
  const booked = plan.booked[slug] ?? [];
  const complete = essential.length > 0 && essential.every((n) => booked.includes(n.categorySlug));

  // Booking the last essential here: say so
  const [cheer, setCheer] = useState(false);
  const wasComplete = useRef(complete);
  useEffect(() => {
    if (complete && !wasComplete.current) {
      successHaptic();
      setCheer(true);
    }
    wasComplete.current = complete;
  }, [complete]);

  if (!event) {
    return (
      <NavScreen title={null}>
        {view.loading || view.isPending ? (
          <StateView state="loading" />
        ) : view.isError ? (
          <StateView state="error" onRetry={() => void view.refetch()} />
        ) : (
          <StateView
            state="empty"
            icon="calendar-outline"
            message={t('event.notFound')}
            action={{ label: t('planner.event.back'), onPress: () => router.navigate('/plan') }}
          />
        )}
      </NavScreen>
    );
  }

  const name = localized(event.name);
  const stillNeeds = stillNeedsText(unbookedNames(essential, booked), t);
  const group = groupOf(days.groups, slug);
  const date = group?.date ?? null;
  const sameDayAs =
    group && group.slugs.length > 1
      ? group.slugs
          .filter((s) => s !== slug)
          .map((s) => days.listed.find((e) => e.slug === s)?.name ?? s)
          .join(', ')
      : null;
  const guests = plan.guests?.[slug] ?? null;
  const when = whenLine(wedding?.eventTimes[slug], wedding?.eventPlaces[slug]);
  const coming = comingLine(
    guestSummary.data?.find((s) => s.eventSlug === slug),
    t,
  );
  const vaultCount = vault.data?.events.find((e) => e.slug === slug)?.count ?? 0;
  const hasDay = days.order.includes(slug);

  // The other days, dotted on the calendar
  const marks: Record<string, string[]> = {};
  for (const other of days.groups) {
    if (!other.date || other === group) continue;
    marks[other.date] = other.slugs.map((s) => days.listed.find((e) => e.slug === s)?.name ?? s);
  }

  const tile = (need: (typeof essential)[number], style: object) => (
    <NeedTile
      key={need.categorySlug}
      need={need}
      eventSlug={slug}
      booked={booked.includes(need.categorySlug)}
      bookedWith={wedding?.bookedVendors[`${slug}/${need.categorySlug}`]?.name ?? null}
      suggested={suggested[`${slug}/${need.categorySlug}`] ?? 0}
      guests={guests}
      canEdit={canEdit}
      onToggle={() => view.toggleBooked(slug, need.categorySlug)}
      style={style}
    />
  );

  return (
    <NavScreen
      title={name}
      subtitle={complete ? t('planner.event.allSet') : stillNeeds}
      trailing={
        <AskWedButton
          variant="round"
          a11y="Ask Wed"
          about={{ kind: 'event', id: slug, label: event.name.en }}
          ask={`What should we book next for the ${event.name.en}?`}
        />
      }
    >
      {cheer && (
        <Animated.View entering={Motion.rise} style={styles.cheer} accessibilityLiveRegion="polite">
          <View style={styles.cheerIcon}>
            <Icon name="checkmark" size={20} color={Colors.onPrimary} weight="bold" />
          </View>
          <AppText weight={600} style={styles.grow}>
            {t('planner.cheerDone', { event: name })}
          </AppText>
        </Animated.View>
      )}

      <ListSection inset>
        {hasDay && (
          <ListRow
            icon="calendar-outline"
            title={date ? longDate(date) : t('planner.days.pick')}
            tone={date ? 'default' : 'primary'}
            subtitle={sameDayAs ? t('planner.event.alongside', { events: sameDayAs }) : undefined}
            onPress={
              canEdit
                ? () => {
                    selectionHaptic();
                    setSheet('day');
                  }
                : undefined
            }
          />
        )}
        <ListRow
          icon="time-outline"
          title={when ?? t('planner.ticket.timePlace')}
          tone={when ? 'default' : 'primary'}
          onPress={
            canEdit
              ? () => {
                  selectionHaptic();
                  setSheet('place');
                }
              : undefined
          }
        />
        <ListRow
          icon="people-outline"
          title={
            guests
              ? t('planner.event.guests', { band: t(`inquiry.guestBands.${guests}`) })
              : t('planner.guestsTitle')
          }
          tone={guests ? 'default' : 'primary'}
          subtitle={coming ?? undefined}
          onPress={
            canEdit
              ? () => {
                  selectionHaptic();
                  setSheet('guests');
                }
              : undefined
          }
        />
      </ListSection>

      {essential.length > 0 && (
        <View style={styles.block}>
          <SectionTitle>{t('planner.event.essentials')}</SectionTitle>
          <View style={styles.grid}>{essential.map((need) => tile(need, styles.half))}</View>
        </View>
      )}

      {extras.length > 0 && (
        <View style={styles.block}>
          <SectionTitle>{t('event.niceToHave')}</SectionTitle>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.bleed}
            contentContainerStyle={styles.side}
          >
            {extras.map((need) => tile(need, styles.sideTile))}
          </ScrollView>
        </View>
      )}

      <ListSection inset>
        {!complete && essential.length > 0 && (
          <AskWedButton
            variant="row"
            label={t('planner.event.wedFind', { event: name })}
            about={{ kind: 'event', id: slug, label: event.name.en }}
            ask={`Find the vendors we still need for the ${event.name.en}`}
          />
        )}
        {canEdit && (
          <ListRow
            icon="megaphone-outline"
            title={t('requests.post.fromPlan')}
            onPress={() => router.push({ pathname: '/request-new', params: { event: slug } })}
          />
        )}
        {vault.data && (
          <ListRow
            leading={
              <View style={styles.rowIcon}>
                <VaultIcon size={Sizes.icon} color={Colors.primary} />
              </View>
            }
            title={t('memoryVault.eventRow', { count: vaultCount })}
            onPress={() =>
              router.push({
                pathname: '/vault/[id]',
                params: { id: vault.data!.id, event: slug },
              })
            }
          />
        )}
      </ListSection>

      <DaySheet
        title={sheet === 'day' ? t('planner.days.sheetTitle', { event: name }) : null}
        value={date}
        marks={marks}
        near={days.groups.find((g) => g.date)?.date ?? null}
        onPick={(picked) => days.change(setDay(days.order, days.state, slug, picked))}
        onClear={() => days.change(setDay(days.order, days.state, slug, null))}
        onClose={() => setSheet(null)}
      />
      <PlaceSheet
        title={sheet === 'place' ? t('planner.place.title', { event: name }) : null}
        place={wedding?.eventPlaces[slug] ?? null}
        time={wedding?.eventTimes[slug] ?? null}
        bookedVenue={bookedVenueName(
          sections.flatMap((s) => s.needs),
          slug,
          wedding?.bookedVendors ?? {},
        )}
        onSave={(place, time) => {
          if (place !== (wedding?.eventPlaces[slug] ?? null)) view.setEventPlace(slug, place);
          if (time !== (wedding?.eventTimes[slug] ?? null)) view.setEventTime(slug, time);
        }}
        onClose={() => setSheet(null)}
      />
      <BottomSheet
        title={sheet === 'guests' ? t('planner.guestsTitle') : null}
        onClose={() => setSheet(null)}
      >
        <ListSection>
          {GUEST_BANDS.map((band) => (
            <ListRow
              key={band}
              title={t(`inquiry.guestBands.${band}`)}
              accessibilityRole="radio"
              checked={guests === band}
              onPress={() => {
                selectionHaptic();
                view.setEventGuests(slug, guests === band ? null : band);
                setSheet(null);
              }}
            />
          ))}
        </ListSection>
      </BottomSheet>
    </NavScreen>
  );
}

const useStyles = makeStyles((Colors) => ({
  block: {
    gap: Spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  half: {
    flexBasis: '46%',
    flexGrow: 1,
  },
  bleed: {
    marginHorizontal: -Sizes.pageGutter,
  },
  side: {
    gap: Spacing.md,
    paddingHorizontal: Sizes.pageGutter,
  },
  sideTile: {
    width: SIDE_TILE,
  },
  rowIcon: {
    width: Sizes.rowIcon,
    alignItems: 'center',
  },
  cheer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.successTint,
  },
  cheerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.success,
  },
  grow: {
    flex: 1,
  },
}));
