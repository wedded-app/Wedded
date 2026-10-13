/**
 * The faith question and the roots question that follows it only when it
 * matters (docs/DECISIONS.md, 2026-10-07). Pure, so tests can load it.
 *
 * Every tradition in `cultures` names its faith and, unless it's faith-wide,
 * where the families are from. A faith card stands for that faith's
 * traditions: with one (Sikh today), picking the faith is enough; with
 * several (Muslim: Pakistani, Arab and the faith-wide Muslim one), "Where are
 * the families from?" picks between them. A tradition added to the database
 * brings the question to its faith without an app change.
 */
import type { Choice, Tradition, TraditionEvent } from '@/data/reference';
import { mergedEvents, signatureEvents } from '@/features/planner/plan-helpers';

export type FaithOption = { faith: Choice; traditions: Tradition[] };

/** The faiths that have at least one tradition, in the founders' order, each with its traditions. */
export function faithOptions(faiths: Choice[], traditions: Tradition[]): FaithOption[] {
  return faiths
    .map((faith) => ({ faith, traditions: traditions.filter((t) => t.faithSlug === faith.slug) }))
    .filter((option) => option.traditions.length > 0);
}

/**
 * The tradition that stands for a faith when the family doesn't say where
 * they're from: the faith-wide one, otherwise the first.
 */
export function faithWide(traditions: Tradition[]): Tradition | undefined {
  return traditions.find((t) => t.backgroundSlug === null) ?? traditions[0];
}

/** The picked faiths with more than one tradition, so the roots question has something to ask. */
export function faithsNeedingRoots(picked: string[], traditions: Tradition[]): string[] {
  return picked.filter((faith) => traditions.filter((t) => t.faithSlug === faith).length > 1);
}

/**
 * The traditions the answers lead to, in the founders' order: for each
 * picked faith, the ones picked on the roots question, or the faith's own
 * when nothing was picked there. Roots under a faith that was unpicked drop
 * out.
 */
export function traditionsForFaiths(
  picked: string[],
  roots: string[],
  traditions: Tradition[],
): Tradition[] {
  const result = new Set<Tradition>();
  for (const faith of picked) {
    const own = traditions.filter((t) => t.faithSlug === faith);
    const chosen = own.filter((t) => roots.includes(t.slug));
    const lead = chosen.length > 0 ? chosen : [faithWide(own)];
    for (const tradition of lead) if (tradition) result.add(tradition);
  }
  return traditions.filter((t) => result.has(t));
}

/** The answers that bring back these traditions, for a plan started from a typed search. */
export function answersForTraditions(picked: Tradition[]): { faiths: string[]; roots: string[] } {
  const faiths = [...new Set(picked.flatMap((t) => (t.faithSlug ? [t.faithSlug] : [])))];
  return { faiths, roots: picked.map((t) => t.slug) };
}

/** A tradition's main events, without the Whole wedding card every tradition shares. */
function mainEvents(events: TraditionEvent[]): TraditionEvent[] {
  return events.filter((event) => event.isCore && event.phase !== 'whole_wedding');
}

/**
 * What sets one place's wedding apart, for the roots answers: its main
 * events that the faith-wide tradition doesn't have (Dholki · Mayun · Shadi
 * for Pakistan), topped up with its signature events, in ceremony order. The
 * faith-wide one itself shows its signature events.
 */
export function tellingEvents(
  tradition: Tradition,
  wide: Tradition | undefined,
  count = 3,
): TraditionEvent[] {
  const signature = signatureEvents(tradition, count);
  if (!wide || wide.slug === tradition.slug) return signature;
  const shared = new Set(mainEvents(wide.events).map((event) => event.slug));
  const main = mainEvents(tradition.events);
  const picked = new Set(
    main
      .filter((event) => !shared.has(event.slug))
      .slice(0, count)
      .map((event) => event.slug),
  );
  for (const event of signature) if (picked.size < count) picked.add(event.slug);
  return main.filter((event) => picked.has(event.slug));
}

/**
 * The events to name in their plan so far: each tradition's signature
 * events, once each, up to `shown`, and how many more main events there are.
 */
export function previewEvents(
  picked: Tradition[],
  shown = 3,
): { events: TraditionEvent[]; more: number } {
  const seen = new Set<string>();
  const lead: TraditionEvent[] = [];
  for (const tradition of picked) {
    for (const event of signatureEvents(tradition)) {
      if (!seen.has(event.slug)) {
        seen.add(event.slug);
        lead.push(event);
      }
    }
  }
  const events = lead.slice(0, shown);
  return { events, more: mainEvents(mergedEvents(picked)).length - events.length };
}
