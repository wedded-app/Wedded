import { router } from 'expo-router';
import Animated from 'react-native-reanimated';

import type { EventNeedsSection, TraditionEvent } from '@/data/reference';
import { formatDate } from '@/features/inquiry/inquiry-helpers';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';
import { Motion } from '@/lib/motion';

import { EventTicket } from './event-ticket';
import { essentialNeeds } from './plan';
import { bookedNames, bookedText, stillNeedsText, unbookedNames } from './still-needs';

type BookedVendors = Record<string, { slug: string; name: string }>;

/**
 * One event on the Wedding tab: its ticket, with what it still needs in
 * words, who's booked and how many are coming. A tap opens the event's own
 * page (/plan-event/{slug}), where its day, guests and what to book are.
 */
export function EventPlan({
  event,
  sections,
  booked,
  bookedVendors,
  date,
  when,
  coming,
}: {
  event: TraditionEvent;
  sections: EventNeedsSection[];
  booked: string[];
  bookedVendors: BookedVendors;
  /** The event's day, yyyy-mm-dd, when it has one. */
  date: string | null;
  /** When it starts and where, as the family typed it for guests. */
  when: string | null;
  /** How many are coming, from the RSVPs. */
  coming: string | null;
}) {
  const { t } = useLocale();
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

  return (
    // The tickets fade in together, 200 ms
    <Animated.View entering={Motion.enter} layout={Motion.layout}>
      <EventTicket
        slug={event.slug}
        name={name}
        date={date}
        when={whenShown}
        stillNeeds={stillNeeds}
        complete={complete}
        booked={bookedLine}
        coming={coming}
        onPress={() => {
          selectionHaptic();
          router.push({ pathname: '/plan-event/[slug]', params: { slug: event.slug } });
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
    </Animated.View>
  );
}
