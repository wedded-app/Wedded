import { matchCities, useCities } from '@/data/places';
import { useTraditions } from '@/data/reference';
import { useStartWedding, useWeddingPlan } from '@/data/wedding';
import { useSession } from '@/features/auth/session';
import { clearWeddingDraft } from '@/features/home/wedding-draft';
import { useSearchLocation } from '@/features/location/search-location';
import { EMPTY_PLAN } from '@/features/planner/plan';

import { getAnswers } from './answers';
import { eventChoices, planFor, startingChoice, traditionsForFaiths } from './faith';
import { markOnboarding } from './onboarding-state';

/**
 * Turns the first questions into the family's plan, saved to their account:
 * the traditions their faith and roots lead to (never the faith itself),
 * plus any that an added event comes from, the events they chose (changed
 * any time on the Wedding tab), each one's day and the main day. An
 * account that already has a wedding (one started with nothing in it) is
 * filled in instead. With no
 * search area picked yet, vendors are searched near the city they gave in
 * About you, so results show distances from the start. Throws if saving
 * fails, so the last question can say so and try again.
 */
export function useFinishOnboarding() {
  const wedding = useWeddingPlan();
  const traditions = useTraditions();
  const cities = useCities();
  const { profile } = useSession();
  const { place, setPlace } = useSearchLocation();
  const startWedding = useStartWedding();

  const finish = async () => {
    const answers = getAnswers();
    const all = traditions.data ?? [];
    const picked = traditionsForFaiths(answers.faiths, answers.roots, all);
    // The events they chose, or, if they skipped that question, the main
    // ones and any named in a search ("mehndi and jaago")
    const { main, ordered } = eventChoices(picked, all);
    const chosen = answers.events ?? startingChoice(main, ordered, answers.extraEvents);
    const plan = planFor(chosen, picked, all);
    const slugs = plan.traditions.map((t) => t.slug);
    const events = plan.events;
    const eventDates = Object.fromEntries(
      Object.entries(answers.eventDates).filter(([slug]) => events.includes(slug)),
    );
    const band = answers.guestBand;

    if (wedding.wedding) {
      if (slugs.length > 0) wedding.setTraditions(slugs);
      if (answers.weddingDate) wedding.setWeddingDate(answers.weddingDate);
      if (events.length > 0) wedding.addEvents(events);
      if (band) for (const event of events) wedding.setEventGuests(event, band);
      for (const [event, date] of Object.entries(eventDates)) wedding.setEventDate(event, date);
    } else {
      await startWedding.mutateAsync({
        ...EMPTY_PLAN,
        traditions: slugs,
        weddingDate: answers.weddingDate,
        events,
        guests: band ? Object.fromEntries(events.map((event) => [event, band])) : {},
        eventDates,
        planningFor: answers.planningFor,
      });
    }

    // A city named in a search wins; otherwise the About you city, unless
    // they've already picked an area
    const searchedCity = cities.data?.find((c) => c.slug === answers.citySlug);
    const typed = profile?.city?.split(',')[0] ?? '';
    const city = searchedCity ?? (place ? undefined : matchCities(cities.data ?? [], typed, 1)[0]);
    if (city) setPlace({ label: city.name, latitude: city.latitude, longitude: city.longitude });

    // The account has the wedding now; the phone's draft has done its job
    clearWeddingDraft();
    markOnboarding('done');
  };

  return { finish, saving: startWedding.isPending };
}
