import { matchCities, useCities } from '@/data/places';
import { useTraditions } from '@/data/reference';
import { useStartWedding, useWeddingPlan } from '@/data/wedding';
import { useSession } from '@/features/auth/session';
import { useSearchLocation } from '@/features/location/search-location';
import { EMPTY_PLAN, startingEvents } from '@/features/planner/plan';

import { getAnswers } from './answers';
import { traditionsForFaiths } from './faith';
import { markOnboarding } from './onboarding-state';

/**
 * Turns the first questions into the family's plan, saved to their account:
 * the traditions their faith and roots lead to (never the faith itself),
 * those traditions' main events (changed
 * any time in My Wedding) and the date. An account that already has a
 * wedding (one started with nothing in it) is filled in instead. With no
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
    const picked = traditionsForFaiths(answers.faiths, answers.roots, traditions.data ?? []);
    const slugs = picked.map((t) => t.slug);
    // Events named in a search ("mehndi and jaago") join the main events
    const known = new Set((traditions.data ?? []).flatMap((t) => t.events.map((e) => e.slug)));
    const main = startingEvents(picked);
    const named = answers.extraEvents.filter((slug) => known.has(slug) && !main.includes(slug));
    const events = [...main, ...named];
    const band = answers.guestBand;

    if (wedding.wedding) {
      if (slugs.length > 0) wedding.setTraditions(slugs);
      if (answers.weddingDate) wedding.setWeddingDate(answers.weddingDate);
      if (events.length > 0) wedding.addEvents(events);
      if (band) for (const event of events) wedding.setEventGuests(event, band);
    } else {
      await startWedding.mutateAsync({
        ...EMPTY_PLAN,
        traditions: slugs,
        weddingDate: answers.weddingDate,
        events,
        guests: band ? Object.fromEntries(events.map((event) => [event, band])) : {},
        planningFor: answers.planningFor,
      });
    }

    // A city named in a search wins; otherwise the About you city, unless
    // they've already picked an area
    const searchedCity = cities.data?.find((c) => c.slug === answers.citySlug);
    const typed = profile?.city?.split(',')[0] ?? '';
    const city = searchedCity ?? (place ? undefined : matchCities(cities.data ?? [], typed, 1)[0]);
    if (city) setPlace({ label: city.name, latitude: city.latitude, longitude: city.longitude });

    markOnboarding('done');
  };

  return { finish, saving: startWedding.isPending };
}
