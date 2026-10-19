/**
 * Category questions on the inquiry form (vision §6 "Inquiry asks"), sent as
 * `details` and printed on the vendor's booking sheet. All chips and toggles,
 * never long text.
 *
 * Which categories get which questions is a display-only mapping for now; it
 * can move to a column on `categories` once more categories get their own
 * questions.
 */
/** Which questions a vendor type's inquiry asks (categories.inquiry_questions). */
export type QuestionSet = 'venue' | 'caterer' | null;

export type DayPart = 'morning' | 'afternoon' | 'evening';
export type TourSlot = { date: string | null; part: DayPart };

export type VenueAnswers = {
  catering: 'in_house' | 'own' | 'not_sure' | null;
  ownCaterer: string;
  alcohol: 'yes' | 'no' | 'not_sure' | null;
  ghoriDhol: boolean | null;
  sameDay: boolean | null;
  /** Only for "Book a tour": up to 3 times they could visit. */
  tourSlots: TourSlot[];
};

export type CatererAnswers = {
  food: 'veg' | 'veg_nonveg' | 'jhatka' | 'halal' | null;
  liveStations: string[];
  hall: string;
  tasting: boolean | null;
};

export const LIVE_STATIONS = ['tandoor', 'chaat', 'jalebi', 'dosa', 'kulfi', 'chai'];

export const emptyVenueAnswers = (): VenueAnswers => ({
  catering: null,
  ownCaterer: '',
  alcohol: null,
  ghoriDhol: null,
  sameDay: null,
  tourSlots: [],
});

export const emptyCatererAnswers = (): CatererAnswers => ({
  food: null,
  liveStations: [],
  hall: '',
  tasting: null,
});

/** Only what they answered, in the shape the booking sheet prints. */
export function venueDetails(answers: VenueAnswers, isTour: boolean): Record<string, unknown> {
  const details: Record<string, unknown> = {};
  if (answers.catering) details.catering = answers.catering;
  if (answers.catering === 'own' && answers.ownCaterer.trim()) {
    details.ownCaterer = answers.ownCaterer.trim();
  }
  if (answers.alcohol) details.alcohol = answers.alcohol;
  if (answers.ghoriDhol !== null) details.ghoriDhol = answers.ghoriDhol;
  if (answers.sameDay !== null) details.sameDay = answers.sameDay;
  if (isTour) {
    details.tour = true;
    const slots = answers.tourSlots.filter((slot) => slot.date);
    if (slots.length > 0) details.tourSlots = slots;
  }
  return details;
}

export function catererDetails(answers: CatererAnswers): Record<string, unknown> {
  const details: Record<string, unknown> = {};
  if (answers.food) details.food = answers.food;
  if (answers.liveStations.length > 0) details.liveStations = answers.liveStations;
  if (answers.hall.trim()) details.hall = answers.hall.trim();
  if (answers.tasting !== null) details.tasting = answers.tasting;
  return details;
}
