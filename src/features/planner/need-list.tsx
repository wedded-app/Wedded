import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText, useFontScale } from '@/components/app-text';
import { CheckCircle } from '@/components/check-circle';
import { groupIcon } from '@/components/group-icon';
import { Icon } from '@/components/icon';
import { ListRow, ListSection, SectionTitle } from '@/components/list';
import { makeStyles, Sizes, Spacing, useColors } from '@/constants/theme';
import type { EventNeed } from '@/data/reference';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic, successHaptic } from '@/lib/haptics';
import { Motion } from '@/lib/motion';

import { findForPlan } from './find-for-plan';
import { bookedNames, bookedText } from './still-needs';

/** How many of the vendors still to book show before "See all". */
const FIRST = 3;

export type NeedListProps = {
  eventSlug: string;
  essential: EventNeed[];
  /** The nice-to-haves, kept behind More ideas. */
  extras: EventNeed[];
  /** The kinds of vendor booked for this event. */
  booked: string[];
  /** By "event/category": the vendor booked, when the booking names one. */
  bookedVendors: Record<string, { name: string }>;
  /** By "event/category": suggestions waiting for the family to decide. */
  suggested: Record<string, number>;
  /** The event's guest band, which Find turns into filters. */
  guests: string | null;
  canEdit: boolean;
  onToggle: (categorySlug: string) => void;
};

/**
 * What an event still needs, a few at a time (Fezy, 2026-11-08: seven tiles
 * at once was too much): the first three essentials to book as rows, the
 * rest behind See all; what's booked in one line that opens to the list;
 * and the nice-to-haves behind More ideas. A row finds that kind of vendor
 * near them for this event; its tick marks it booked.
 */
export function NeedList({
  eventSlug,
  essential,
  extras,
  booked,
  bookedVendors,
  suggested,
  guests,
  canEdit,
  onToggle,
}: NeedListProps) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const [allShown, setAllShown] = useState(false);
  const [bookedShown, setBookedShown] = useState(false);
  const [ideasShown, setIdeasShown] = useState(false);

  const isBooked = (need: EventNeed) => booked.includes(need.categorySlug);
  const toBook = essential.filter((need) => !isBooked(need));
  const ideas = extras.filter((need) => !isBooked(need));
  const done = [...essential, ...extras].filter(isBooked);
  const shown = allShown ? toBook : toBook.slice(0, FIRST);
  const vendorFor = (slug: string) => bookedVendors[`${eventSlug}/${slug}`]?.name ?? null;
  const bookedLine = bookedText(bookedNames(done, booked, vendorFor), t);

  const row = (need: EventNeed) => (
    <NeedRow
      key={need.categorySlug}
      need={need}
      booked={isBooked(need)}
      bookedWith={vendorFor(need.categorySlug)}
      suggested={suggested[`${eventSlug}/${need.categorySlug}`] ?? 0}
      canEdit={canEdit}
      onFind={() => findForPlan(need.categorySlug, need.groupSlug, eventSlug, guests)}
      onToggle={() => onToggle(need.categorySlug)}
    />
  );
  const opener = (open: boolean) => (
    <Icon
      name={open ? 'chevron-up' : 'chevron-down'}
      size={17}
      color={Colors.chevron}
      weight="semibold"
    />
  );

  return (
    <>
      {toBook.length > 0 && (
        <Animated.View layout={Motion.layout} style={styles.block}>
          <SectionTitle>{t('planner.needs.title')}</SectionTitle>
          <ListSection inset>
            {shown.map(row)}
            {toBook.length > shown.length && (
              <ListRow
                title={t('planner.needs.seeAll', { count: toBook.length })}
                tone="primary"
                onPress={() => {
                  selectionHaptic();
                  setAllShown(true);
                }}
              />
            )}
          </ListSection>
        </Animated.View>
      )}

      {(bookedLine || ideas.length > 0) && (
        <Animated.View layout={Motion.layout}>
          <ListSection inset>
            {bookedLine && (
              <ListRow
                icon="checkmark-circle-outline"
                iconColor="success"
                title={bookedLine}
                trailing={opener(bookedShown)}
                chevron={false}
                onPress={() => {
                  selectionHaptic();
                  setBookedShown((open) => !open);
                }}
              />
            )}
            {bookedShown && done.map(row)}
            {ideas.length > 0 && (
              <ListRow
                icon="bulb-outline"
                title={t('planner.needs.ideas')}
                trailing={opener(ideasShown)}
                chevron={false}
                onPress={() => {
                  selectionHaptic();
                  setIdeasShown((open) => !open);
                }}
              />
            )}
            {ideasShown && ideas.map(row)}
          </ListSection>
        </Animated.View>
      )}
    </>
  );
}

/**
 * One kind of vendor as a row: its glyph, its name and below it who's
 * booked, how many suggestions wait, or Find; then its tick, beside the
 * row rather than inside it, so screen readers reach both.
 */
function NeedRow({
  need,
  booked,
  bookedWith,
  suggested,
  canEdit,
  onFind,
  onToggle,
}: {
  need: EventNeed;
  booked: boolean;
  bookedWith: string | null;
  suggested: number;
  canEdit: boolean;
  onFind: () => void;
  onToggle: () => void;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const scale = Math.min(useFontScale('body'), 1.4);
  const name = localized(need.name);

  let status: string;
  let tone: 'success' | 'primary' = 'primary';
  if (booked) {
    status = bookedWith ? t('planner.bookedWith', { name: bookedWith }) : t('planner.event.booked');
    tone = 'success';
  } else if (suggested > 0) {
    status = t('suggestions.openCount', { count: suggested });
  } else {
    status = t('planner.findShort');
  }

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${name}, ${status}`}
        accessibilityHint={t('planner.find', { name })}
        onPress={() => {
          selectionHaptic();
          onFind();
        }}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
      >
        <View style={[styles.iconSlot, { width: Sizes.rowIcon * scale }]}>
          <Icon
            name={groupIcon(need.groupSlug)}
            size={Sizes.icon * scale}
            color={booked ? Colors.success : Colors.primary}
          />
        </View>
        <View style={styles.text}>
          <AppText>{name}</AppText>
          <View style={styles.status}>
            <AppText variant="label" weight={600} color={tone} style={styles.shrink}>
              {status}
            </AppText>
            {!booked && suggested === 0 && (
              <Icon name="arrow-forward" size={15} color={Colors.primary} weight="semibold" />
            )}
          </View>
        </View>
      </Pressable>
      {canEdit && (
        <View style={styles.tick}>
          <CheckCircle
            checked={booked}
            accessibilityLabel={t('planner.markBooked', { name })}
            onPress={() => {
              if (booked) selectionHaptic();
              else successHaptic();
              onToggle();
            }}
          />
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  block: {
    gap: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  main: {
    flex: 1,
    minHeight: Sizes.row,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  pressed: {
    backgroundColor: Colors.rowPressed,
  },
  iconSlot: {
    alignItems: 'center',
  },
  text: {
    flex: 1,
    gap: 2,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  shrink: {
    flexShrink: 1,
  },
  tick: {
    paddingRight: Spacing.md,
  },
}));
