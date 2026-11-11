import { matchCities, useCities } from '@/data/places';
import { useTraditions, type Tradition } from '@/data/reference';
import { useStartWedding, useWeddingPlan } from '@/data/wedding';
import { useSession } from '@/features/auth/session';
import { clearWeddingDraft, setWeddingDraft } from '@/features/home/wedding-draft';
import { useSearchLocation } from '@/features/location/search-location';
import { EMPTY_PLAN } from '@/features/planner/plan';

import { getAnswers, type Answers } from './answers';
import { eventChoices, planFor, startingChoice, traditionsForFaiths } from './faith';
import { markOnboarding } from './onboarding-state';

/**
 * What the answers make: the traditions their faith and roots lead to
 * (never the faith itself), plus any that an added event comes from, the
 * events they chose (or, if they skipped that question, the main ones and
 * any named in a search: "mehndi and jaago"), and each one's day.
 */
export function planFromAnswers(answers: Answers, all: Tradition[]) {
  const picked = traditionsForFaiths(answers.faiths, answers.roots, all);
  const { main, ordered } = eventChoices(picked, all);
  const chosen = answers.events ?? startingChoice(main, ordered, answers.extraEvents);
  const plan = planFor(chosen, picked, all);
  const events = plan.events;
  const eventDates = Object.fromEntries(
    Object.entries(answers.eventDates).filter(([slug]) => events.includes(slug)),
  );
  return { traditions: plan.traditions.map((t) => t.slug), events, eventDates };
}

/**
 * The end of the first questions. Signed in, `finish` saves the plan to
 * their account: the traditions, the events (changed any time on the
 * Wedding tab), each one's day, the main day and the guests. An account
 * that already has a wedding (one started with nothing in it) is filled in
 * instead. Throws if saving fails, so the last question can say so and try
 * again. Signed out, `keepOnPhone` keeps the same plan on this phone for
 * Home to show until they save it (useSaveDraftPlan). Either way, with no
 * search area picked yet, vendors are searched near the city named in a
 * search or in About you, so results show distances from the start.
 */
export function useFinishOnboarding() {
  const wedding = useWeddingPlan();
  const traditions = useTraditions();
  const cities = useCities();
  const { profile } = useSession();
  const { place, setPlace } = useSearchLocation();
  const startWedding = useStartWedding();

  const searchNear = () => {
    const answers = getAnswers();
    // A city named in a search wins; otherwise the About you city, unless
    // they've already picked an area
    const searchedCity = cities.data?.find((c) => c.slug === answers.citySlug);
    const typed = profile?.city?.split(',')[0] ?? '';
    const city = searchedCity ?? (place ? undefined : matchCities(cities.data ?? [], typed, 1)[0]);
    if (city) setPlace({ label: city.name, latitude: city.latitude, longitude: city.longitude });
  };

  const finish = async () => {
    const answers = getAnswers();
    const {
      traditions: slugs,
      events,
      eventDates,
    } = planFromAnswers(answers, traditions.data ?? []);
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

    searchNear();
    // The account has the wedding now; the phone's draft has done its job
    clearWeddingDraft();
    markOnboarding('done');
  };

  const keepOnPhone = () => {
    const answers = getAnswers();
    const made = planFromAnswers(answers, traditions.data ?? []);
    setWeddingDraft({
      date: answers.weddingDate,
      noDateYet: !answers.weddingDate && answers.noDateYet,
      guestBand: answers.guestBand,
      traditions: made.traditions,
      events: made.events,
      eventDates: made.eventDates,
      planningFor: answers.planningFor,
    });
    searchNear();
    markOnboarding('done');
  };

  return { finish, keepOnPhone, saving: startWedding.isPending };
}
