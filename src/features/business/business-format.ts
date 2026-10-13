import { percentChange } from '@/data/business';
import { formatDate } from '@/features/inquiry/inquiry-helpers';

type Translate = (key: string, options?: Record<string, string | number>) => string;

export type Change = { kind: 'up' | 'down' | 'same'; percent: number } | null;

/**
 * How a number moved from the period before: up or down by a whole percent,
 * the same, or null when there's nothing to compare with.
 */
export function changeFrom(current: number, previous: number): Change {
  const percent = percentChange(current, previous);
  if (percent === null) return null;
  if (percent === 0) return { kind: 'same', percent: 0 };
  return { kind: percent > 0 ? 'up' : 'down', percent: Math.abs(percent) };
}

const yesNo = (value: unknown, t: Translate) =>
  value === true ? t('inquiry.questions.yes') : value === false ? t('inquiry.questions.no') : null;

const FOOD: Record<string, string> = {
  veg: 'foodVeg',
  veg_nonveg: 'foodVegNonVeg',
  jhatka: 'foodJhatka',
  halal: 'foodHalal',
};

/**
 * A lead's answers to the hall or caterer questions as label and value rows,
 * in the Ask form's own words. Anything unanswered or unknown is left out.
 */
export function leadAnswerRows(
  details: Record<string, unknown>,
  t: Translate,
): { label: string; value: string }[] {
  const q = (key: string) => t(`inquiry.questions.${key}`);
  const rows: { label: string; value: string }[] = [];
  const add = (label: string, value: string | null) => {
    if (value) rows.push({ label, value });
  };

  if (details.catering === 'in_house') add(q('catering'), q('cateringInHouse'));
  if (details.catering === 'own') {
    const who = typeof details.ownCaterer === 'string' ? details.ownCaterer : '';
    add(q('catering'), who ? `${q('cateringOwn')}: ${who}` : q('cateringOwn'));
  }
  if (details.catering === 'not_sure') add(q('catering'), q('notSure'));
  if (details.alcohol === 'yes' || details.alcohol === 'no') {
    add(q('alcohol'), q(details.alcohol));
  }
  if (details.alcohol === 'not_sure') add(q('alcohol'), q('notSure'));
  add(q('ghoriDhol'), yesNo(details.ghoriDhol, t));
  add(q('sameDay'), yesNo(details.sameDay, t));
  if (Array.isArray(details.tourSlots)) {
    const slots = details.tourSlots
      .filter(
        (slot): slot is { date: string; part: string } =>
          !!slot && typeof slot.date === 'string' && typeof slot.part === 'string',
      )
      .map((slot) => `${formatDate(slot.date)}, ${q(`parts.${slot.part}`)}`);
    if (slots.length > 0) add(q('tourSlots'), slots.join('\n'));
  }
  if (typeof details.food === 'string' && FOOD[details.food]) {
    add(q('food'), q(FOOD[details.food]));
  }
  if (Array.isArray(details.liveStations) && details.liveStations.length > 0) {
    add(
      q('liveStations'),
      details.liveStations
        .filter((s): s is string => typeof s === 'string')
        .map((s) => q(`stations.${s}`))
        .join(', '),
    );
  }
  if (typeof details.hall === 'string') add(q('whichHall'), details.hall);
  add(q('tasting'), yesNo(details.tasting, t));
  return rows;
}
