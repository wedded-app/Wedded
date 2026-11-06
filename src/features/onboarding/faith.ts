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

/**
 * What "Which events are you having?" offers: the main events of the
 * traditions their answers lead to (ticked to start with), then everything
 * else those traditions and the rest of their faiths' have (a Muslim family
 * can add a Dholki and a Mayun), once each. `ordered` is all of them in
 * ceremony order. With no tradition ("Something else") it offers every
 * event, none ticked. The Whole wedding card isn't a ceremony, so it's never
 * asked about.
 */
export function eventChoices(
  picked: Tradition[],
  all: Tradition[],
): { main: TraditionEvent[]; more: TraditionEvent[]; ordered: TraditionEvent[] } {
  const faiths = new Set(picked.map((t) => t.faithSlug).filter(Boolean));
  const kin = all.filter(
    (t) => !picked.includes(t) && (picked.length === 0 || faiths.has(t.faithSlug)),
  );
  const main = mergedEvents(picked).filter((e) => e.isCore && e.phase !== 'whole_wedding');
  const ticked = new Set(main.map((e) => e.slug));
  // The picked traditions' names come first, so a shared event keeps theirs
  const ordered = mergedEvents([...picked, ...kin]).filter((e) => e.phase !== 'whole_wedding');
  return { main, more: ordered.filter((e) => !ticked.has(e.slug)), ordered };
}

/**
 * The events ticked before they change anything: the main ones, and any
 * named in a search that brought them here ("mehndi and jaago").
 */
export function startingChoice(
  main: TraditionEvent[],
  ordered: TraditionEvent[],
  named: string[],
): string[] {
  const slugs = main.map((e) => e.slug);
  const extra = ordered.filter((e) => named.includes(e.slug) && !slugs.includes(e.slug));
  return [...slugs, ...extra.map((e) => e.slug)];
}

/**
 * The traditions a plan with these events needs: the ones their answers
 * led to, plus, for an event none of those has, the first tradition that
 * does (a Dholki brings in the Pakistani one). Each tradition's Whole
 * wedding card comes along when it's one of its main events.
 */
export function planFor(
  chosen: string[],
  picked: Tradition[],
  all: Tradition[],
): { traditions: Tradition[]; events: string[] } {
  const traditions = new Set(picked);
  const covered = () => new Set(mergedEvents([...traditions]).map((e) => e.slug));
  for (const slug of chosen) {
    if (covered().has(slug)) continue;
    const faiths = new Set(picked.map((t) => t.faithSlug));
    const owners = all.filter((t) => t.events.some((e) => e.slug === slug));
    const owner = owners.find((t) => faiths.has(t.faithSlug)) ?? owners[0];
    if (owner) traditions.add(owner);
  }
  const ordered = all.filter((t) => traditions.has(t));
  const known = covered();
  const whole = mergedEvents(ordered)
    .filter((e) => e.isCore && e.phase === 'whole_wedding')
    .map((e) => e.slug);
  return {
    traditions: ordered,
    events: [
      ...chosen.filter((slug) => known.has(slug)),
      ...whole.filter((s) => !chosen.includes(s)),
    ],
  };
}
