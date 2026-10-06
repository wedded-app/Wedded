/**
 * Reference data hooks: events, what each event needs, and categories.
 * These tables change only when the founders edit them, so the results stay
 * fresh for a day. Every name comes back as LocalizedText; show it with
 * localized() or bilingual(). Nothing here is hardcoded: order and grouping
 * come from the database (docs/PRODUCT_VISION.md section 3).
 */
import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import { activeTraditions, mergedEvents, usePlan } from '@/features/planner/plan';
import { asLocalizedText, type LocalizedText } from '@/i18n/localized';
import { supabase } from '@/lib/supabase';

const DAY = 24 * 60 * 60 * 1000;
const REFERENCE = { staleTime: DAY, gcTime: DAY } as const;

export const referenceKeys = {
  all: ['reference'] as const,
  event: (slug: string) => [...referenceKeys.all, 'event', slug] as const,
  eventNeeds: (slug: string) => [...referenceKeys.all, 'event-needs', slug] as const,
  categories: () => [...referenceKeys.all, 'categories'] as const,
  traditions: () => [...referenceKeys.all, 'traditions'] as const,
  allEventNeeds: () => [...referenceKeys.all, 'all-event-needs'] as const,
};

/** The row's name, or its slug if the name is somehow unreadable. */
function nameOf(row: { slug: string; name: unknown }): LocalizedText {
  return asLocalizedText(row.name) ?? { en: row.slug };
}

// Home -------------------------------------------------------------------

export type HomeEvent = {
  slug: string;
  name: LocalizedText;
  /** A main event of the family's traditions (Home lists only these). */
  isCore: boolean;
  /** How many kinds of vendor the event needs. */
  vendorTypeCount: number;
  /** Published vendors who serve it. */
  vendorCount: number;
};

/** `phase` is before, wedding_day, after or whole_wedding. */
export type HomeSection = { phase: string; events: HomeEvent[] };

/** Events grouped by phase, keeping their order; sections in the order of their first event. */
function homeSections(all: Tradition[], picked: string[]): HomeSection[] {
  const sections: HomeSection[] = [];
  for (const event of mergedEvents(activeTraditions({ traditions: picked }, all))) {
    let section = sections.find((s) => s.phase === event.phase);
    if (!section) {
      section = { phase: event.phase, events: [] };
      sections.push(section);
    }
    section.events.push({
      slug: event.slug,
      name: event.name,
      isCore: event.isCore,
      vendorTypeCount: event.vendorTypeCount,
      vendorCount: event.vendorCount,
    });
  }
  return sections;
}

/**
 * The family's events (from the traditions picked in My Wedding, or the
 * default culture until they pick), grouped by phase in ceremony order: for
 * Home, "Save to which event?", the inquiry form and event names elsewhere.
 */
export function useHomeEvents() {
  const { traditions: picked } = usePlan();
  const select = useCallback((all: Tradition[]) => homeSections(all, picked), [picked]);
  return useQuery({
    queryKey: referenceKeys.traditions(),
    queryFn: fetchTraditions,
    select,
    ...REFERENCE,
  });
}

// Event page -------------------------------------------------------------

export type EventDetails = {
  slug: string;
  name: LocalizedText;
  /** When it usually happens, e.g. "The night before the wedding". */
  timing: LocalizedText | null;
  /** The founders' two-line explainer; null until written. */
  summary: LocalizedText | null;
};

async function fetchEvent(slug: string): Promise<EventDetails | null> {
  const { data, error } = await supabase
    .from('events')
    .select('slug, name, timing, summary')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    slug: data.slug,
    name: nameOf(data),
    timing: asLocalizedText(data.timing),
    summary: asLocalizedText(data.summary),
  };
}

/** One event, or null when no event has that slug (show "not found"). */
export function useEvent(slug: string) {
  return useQuery({
    queryKey: referenceKeys.event(slug),
    queryFn: () => fetchEvent(slug),
    enabled: slug.length > 0,
    ...REFERENCE,
  });
}

export type EventNeed = {
  categorySlug: string;
  name: LocalizedText;
  /** For the display-only group icon. */
  groupSlug: string;
};

/** `importance` is essential or nice_to_have. */
export type EventNeedsSection = { importance: string; needs: EventNeed[] };

const IMPORTANCE_ORDER = ['essential', 'nice_to_have'];

type NeedRow = {
  importance: string;
  category: { slug: string; name: unknown; group_slug: string };
};

/** Rows in sort order, grouped: essential first, then nice to have. */
function groupNeeds(rows: NeedRow[]): EventNeedsSection[] {
  const sections: EventNeedsSection[] = [];
  for (const row of rows) {
    let section = sections.find((s) => s.importance === row.importance);
    if (!section) {
      section = { importance: row.importance, needs: [] };
      sections.push(section);
    }
    section.needs.push({
      categorySlug: row.category.slug,
      name: nameOf(row.category),
      groupSlug: row.category.group_slug,
    });
  }
  // Essential first, then nice to have; anything new goes last.
  const rank = (importance: string) => {
    const index = IMPORTANCE_ORDER.indexOf(importance);
    return index === -1 ? IMPORTANCE_ORDER.length : index;
  };
  return sections.sort((a, b) => rank(a.importance) - rank(b.importance));
}

async function fetchEventNeeds(slug: string): Promise<EventNeedsSection[]> {
  const { data, error } = await supabase
    .from('event_categories')
    .select('importance, sort_order, category:categories!inner(slug, name, group_slug)')
    .eq('event_slug', slug)
    .order('sort_order');
  if (error) throw error;
  return groupNeeds(data);
}

/** The vendor categories an event needs: essential first, then nice to have. */
export function useEventNeeds(slug: string) {
  return useQuery({
    queryKey: referenceKeys.eventNeeds(slug),
    queryFn: () => fetchEventNeeds(slug),
    enabled: slug.length > 0,
    ...REFERENCE,
  });
}

// Search -----------------------------------------------------------------

export type Category = {
  slug: string;
  name: LocalizedText;
  /** Other spellings and names, in English and Gurmukhi, for matching search text. */
  aliases: string[];
  groupSlug: string;
};

async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('slug, name, aliases, group_slug');
  if (error) throw error;
  return data
    .map((row) => ({
      slug: row.slug,
      name: nameOf(row),
      aliases: row.aliases,
      groupSlug: row.group_slug,
    }))
    .sort((a, b) => a.name.en.localeCompare(b.name.en, 'en'));
}

/** Every category, A to Z by English name. */
export function useCategories() {
  return useQuery({ queryKey: referenceKeys.categories(), queryFn: fetchCategories, ...REFERENCE });
}

// Browse by vendor type ----------------------------------------------------

export type CategoryGroup = {
  slug: string;
  name: LocalizedText;
  /** In the founders' order within the group. */
  categories: { slug: string; name: LocalizedText; groupSlug: string }[];
};

async function fetchCategoryGroups(): Promise<CategoryGroup[]> {
  const { data, error } = await supabase
    .from('category_groups')
    .select('slug, name, sort_order, categories(slug, name, sort_order)')
    .order('sort_order');
  if (error) throw error;
  return data.map((group) => ({
    slug: group.slug,
    name: nameOf(group),
    categories: [...group.categories]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((category) => ({
        slug: category.slug,
        name: nameOf(category),
        groupSlug: group.slug,
      })),
  }));
}

/** Vendor types grouped (Venues, Food, Music...), in the database's order. */
export function useCategoryGroups() {
  return useQuery({
    queryKey: [...referenceKeys.all, 'category-groups'],
    queryFn: fetchCategoryGroups,
    ...REFERENCE,
  });
}

// My Wedding ---------------------------------------------------------------

export type TraditionEvent = {
  slug: string;
  /** What the tradition calls it (Mayun, Henna night), or the event's own name. */
  name: LocalizedText;
  /** before, wedding_day, after or whole_wedding. */
  phase: string;
  /** Ceremony order within the tradition. */
  order: number;
  /** A main event, shown first; the rest sit under More. */
  isCore: boolean;
  /** When it usually happens, e.g. "The night before the wedding". */
  timing: LocalizedText | null;
  /** How many kinds of vendor the event needs. */
  vendorTypeCount: number;
  /** Vendors who serve it. */
  vendorCount: number;
};

export type Tradition = {
  slug: string;
  name: LocalizedText;
  isDefault: boolean;
  /** The background it belongs to (punjabi, pakistani...); null for a faith-wide one. */
  backgroundSlug: string | null;
  /** The faith it belongs to (sikh, muslim...); null when it's about a background alone. */
  faithSlug: string | null;
  /** In ceremony order. */
  events: TraditionEvent[];
};

async function fetchTraditions(): Promise<Tradition[]> {
  const { data, error } = await supabase
    .from('cultures')
    .select(
      'slug, name, is_default, sort_order, background_slug, faith_slug, culture_events(phase, sort_order, is_core, local_name, event:events!inner(slug, name, timing, event_categories(count), vendor_events(count)))',
    )
    .order('sort_order');
  if (error) throw error;
  return data.map((culture) => ({
    slug: culture.slug,
    name: nameOf(culture),
    isDefault: culture.is_default,
    backgroundSlug: culture.background_slug,
    faithSlug: culture.faith_slug,
    events: [...culture.culture_events]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((row) => ({
        slug: row.event.slug,
        name: asLocalizedText(row.local_name) ?? nameOf(row.event),
        phase: row.phase,
        order: row.sort_order,
        isCore: row.is_core,
        timing: asLocalizedText(row.event.timing),
        vendorTypeCount: row.event.event_categories[0]?.count ?? 0,
        vendorCount: row.event.vendor_events[0]?.count ?? 0,
      })),
  }));
}

/** Every wedding tradition (Punjabi Sikh, Pakistani, Arab...) with its events, in the founders' order. */
export function useTraditions() {
  return useQuery({ queryKey: referenceKeys.traditions(), queryFn: fetchTraditions, ...REFERENCE });
}

/** What each event needs, by event slug. */
export type NeedsByEvent = Record<string, EventNeedsSection[]>;

async function fetchAllEventNeeds(): Promise<NeedsByEvent> {
  const { data, error } = await supabase
    .from('event_categories')
    .select('event_slug, importance, sort_order, category:categories!inner(slug, name, group_slug)')
    .order('sort_order');
  if (error) throw error;
  const byEvent = new Map<string, NeedRow[]>();
  for (const row of data) {
    const rows = byEvent.get(row.event_slug) ?? [];
    rows.push(row);
    byEvent.set(row.event_slug, rows);
  }
  return Object.fromEntries([...byEvent].map(([slug, rows]) => [slug, groupNeeds(rows)]));
}

/** What every event needs, in one request, for My Wedding and the Home countdown. */
export function useAllEventNeeds() {
  return useQuery({
    queryKey: referenceKeys.allEventNeeds(),
    queryFn: fetchAllEventNeeds,
    ...REFERENCE,
  });
}
