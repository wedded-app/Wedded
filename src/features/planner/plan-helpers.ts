/** Pure helpers for the My Wedding plan (kept apart from storage so tests can load them). */
import type {
  EventNeed,
  EventNeedsSection,
  NeedsByEvent,
  Tradition,
  TraditionEvent,
} from '@/data/reference';
import type { LocalizedText } from '@/i18n/localized';

export type WeddingPlan = {
  /** The wedding day, yyyy-mm-dd. */
  weddingDate: string | null;
  /** Culture slugs the family picked (Punjabi Sikh, Pakistani...); empty means the default one. */
  traditions: string[];
  /** Event slugs the family is having, in no particular order. */
  events: string[];
  /** Per event, the category slugs they've booked. */
  booked: Record<string, string[]>;
  /** Per event, about how many guests (the inquiry form's bands), so inquiries fill it in. */
  guests?: Record<string, string>;
  /**
   * Set when this is a copy of a plan saved to the account (Plan together):
   * the wedding it mirrors. Cleared on sign-out, so the next person on this
   * phone doesn't see it.
   */
  syncedWeddingId?: string | null;
};

/** Whole days from today to a yyyy-mm-dd date (negative once it has passed). */
export function daysUntil(date: string, today = new Date()): number {
  const [y, m, d] = date.split('-').map(Number);
  const target = Date.UTC(y, m - 1, d);
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target - now) / 86_400_000);
}

/** How many vendor types are booked across the plan's events. */
export function bookedCount(p: WeddingPlan): number {
  return p.events.reduce((sum, slug) => sum + (p.booked[slug]?.length ?? 0), 0);
}

/** The traditions the family picked, in the founders' order, or the default one until they pick. */
export function activeTraditions(
  p: Pick<WeddingPlan, 'traditions'>,
  traditions: Tradition[],
): Tradition[] {
  const picked = traditions.filter((tradition) => p.traditions.includes(tradition.slug));
  if (picked.length > 0) return picked;
  const fallback = traditions.find((tradition) => tradition.isDefault) ?? traditions[0];
  return fallback ? [fallback] : [];
}

// Phases in the order they happen; anything new sorts after the wedding day.
const PHASES = ['before', 'wedding_day', 'after', 'whole_wedding'];
const phaseRank = (phase: string) => {
  const index = PHASES.indexOf(phase);
  return index === -1 ? PHASES.indexOf('whole_wedding') - 0.5 : index;
};

/**
 * The traditions after tapping one. `saved` is what the plan stores (empty
 * until the family picks) and `current` what the screen shows (the default
 * stands in until then), so the first pick replaces the default: a Pakistani
 * family taps Pakistani and that's that, a mixed wedding taps both. Null when
 * nothing would change (the last one can't be unpicked).
 */
export function pickTradition(saved: string[], current: string[], slug: string): string[] | null {
  if (saved.length === 0 && !current.includes(slug)) return [slug];
  const picked = current.includes(slug) ? current.filter((t) => t !== slug) : [...current, slug];
  return picked.length === 0 ? null : picked;
}

/**
 * Every event across the traditions, once each, in ceremony order. A shared
 * event keeps the first tradition's name for it and is a main event if any
 * of the traditions says so.
 */
export function mergedEvents(traditions: Tradition[]): TraditionEvent[] {
  const bySlug = new Map<string, TraditionEvent>();
  for (const tradition of traditions) {
    for (const event of tradition.events) {
      const seen = bySlug.get(event.slug);
      if (!seen) bySlug.set(event.slug, event);
      else if (event.isCore && !seen.isCore) bySlug.set(event.slug, { ...seen, isCore: true });
    }
  }
  return [...bySlug.values()].sort(
    (a, b) => phaseRank(a.phase) - phaseRank(b.phase) || a.order - b.order,
  );
}

/** The main events of the picked traditions: what a new plan starts with. */
export function startingEvents(traditions: Tradition[]): string[] {
  return mergedEvents(traditions)
    .filter((event) => event.isCore)
    .map((event) => event.slug);
}

/**
 * A few events that say what a tradition's wedding is (Jaago · Baraat ·
 * Anand Karaj, Mehndi · Nikah · Walima), for the "What kind of wedding?"
 * cards: the last main event before the day, the first one after it (a
 * Walima is what a Pakistani family looks for), and the day's own in
 * between, in ceremony order.
 */
export function signatureEvents(tradition: Tradition, count = 3): TraditionEvent[] {
  const main = tradition.events.filter((event) => event.isCore);
  const before = main.filter((event) => event.phase === 'before').slice(-1);
  const after = main.filter((event) => event.phase === 'after').slice(0, 1);
  const day = main.filter((event) => event.phase === 'wedding_day');
  const room = Math.max(0, count - before.length - after.length);
  return [...before, ...day.slice(0, room), ...after].slice(0, count);
}

/** The events the family is having, in ceremony order (only those in their traditions). */
export function chosenEvents(p: WeddingPlan, events: TraditionEvent[]): TraditionEvent[] {
  return events.filter((event) => p.events.includes(event.slug));
}

/** An event's essential vendor types, the ones progress counts. */
export function essentialNeeds(sections: EventNeedsSection[] | undefined): EventNeed[] {
  return (sections ?? [])
    .filter((section) => section.importance === 'essential')
    .flatMap((section) => section.needs);
}

/**
 * Essentials booked out of essentials listed, across the chosen events.
 * Nice-to-haves don't count, so the bar can reach the end.
 */
export function planProgress(
  p: WeddingPlan,
  chosen: TraditionEvent[],
  needs: NeedsByEvent,
): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const event of chosen) {
    const listed = essentialNeeds(needs[event.slug]);
    const booked = p.booked[event.slug] ?? [];
    total += listed.length;
    done += listed.filter((need) => booked.includes(need.categorySlug)).length;
  }
  return { done, total };
}

export type NextNeed = { eventSlug: string; eventName: LocalizedText; need: EventNeed };

/** The essentials still to book, soonest event first. */
export function nextToBook(
  p: WeddingPlan,
  chosen: TraditionEvent[],
  needs: NeedsByEvent,
  limit = 3,
): NextNeed[] {
  const next: NextNeed[] = [];
  for (const event of chosen) {
    const booked = p.booked[event.slug] ?? [];
    for (const need of essentialNeeds(needs[event.slug])) {
      if (booked.includes(need.categorySlug)) continue;
      next.push({ eventSlug: event.slug, eventName: event.name, need });
      if (next.length >= limit) return next;
    }
  }
  return next;
}
