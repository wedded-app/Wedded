/**
 * My business insights (C6b, #182): every number a vendor would want about
 * their listing, for their own people only (see the business_insights
 * migration). Day by day numbers, the path from showing up in search to being
 * booked, reply speed, what families ask for, how they compare with vendors
 * like them nearby, each reel's numbers and what's missing from the listing.
 */
import { useQuery } from '@tanstack/react-query';

import { asLocalizedText, type LocalizedText } from '@/i18n/localized';
import { supabase } from '@/lib/supabase';

import { californiaToday, statsPeriods, type StatsPeriod } from './business';
import { reelFileUrl } from './reels';

export const insightKeys = {
  all: ['business-insights'] as const,
  insights: (vendorId: string, days: number, today: string) =>
    [...insightKeys.all, vendorId, days, today] as const,
  reels: (vendorId: string) => [...insightKeys.all, 'reels', vendorId] as const,
  checklist: (vendorId: string) => [...insightKeys.all, 'checklist', vendorId] as const,
};

// Insights ---------------------------------------------------------------------------------

export type DailyNumbers = {
  /** yyyy-mm-dd, California */
  day: string;
  views: number;
  contacts: number;
  saves: number;
  inquiries: number;
};

export type Funnel = {
  /** Times they showed up in search results */
  searches: number;
  views: number;
  saves: number;
  contacts: number;
  inquiries: number;
  /** Families who booked them (a shared plan, or "Yes, we booked them") */
  booked: number;
};

export type Replies = {
  leads: number;
  replied: number;
  /** 0 to 1, or null with no leads */
  rate: number | null;
  /** The typical time to their first reply, or null with no replies */
  medianMinutes: number | null;
};

export type Asks = {
  events: { slug: string; name: LocalizedText; count: number }[];
  /** The inquiry guest bands: under_50, 50_100, 100_250, 250_500, 500_plus, not_sure */
  guests: { band: string; count: number }[];
  /** The month of the wedding, yyyy-mm */
  months: { month: string; count: number }[];
  /** The town they wrote, tidied */
  places: { place: string; count: number }[];
};

export type Compare = {
  category: { slug: string; name: LocalizedText };
  /** Vendors of the same main kind within 50 miles (5 or more) */
  peers: number;
  views: { mine: number; typical: number };
  inquiries: { mine: number; typical: number };
};

export type BusinessInsights = {
  daily: DailyNumbers[];
  funnel: Funnel;
  replies: Replies;
  asks: Asks;
  /** Null when fewer than 5 vendors like them are nearby */
  compare: Compare | null;
};

type Raw = {
  daily: DailyNumbers[] | null;
  funnel: Funnel;
  replies: { leads: number; replied: number; rate: number | null; medianMinutes: number | null };
  asks: {
    events: { slug: string; name: unknown; count: number }[];
    guests: Asks['guests'];
    months: Asks['months'];
    places: Asks['places'];
  };
  compare: (Omit<Compare, 'category'> & { category: { slug: string; name: unknown } }) | null;
};

export function toInsights(raw: Raw): BusinessInsights {
  return {
    daily: raw.daily ?? [],
    funnel: raw.funnel,
    replies: {
      ...raw.replies,
      // jsonb numerics can arrive as strings
      rate: raw.replies.rate === null ? null : Number(raw.replies.rate),
      medianMinutes: raw.replies.medianMinutes === null ? null : Number(raw.replies.medianMinutes),
    },
    asks: {
      ...raw.asks,
      events: raw.asks.events.map((e) => ({
        ...e,
        name: asLocalizedText(e.name) ?? { en: e.slug },
      })),
    },
    compare: raw.compare
      ? {
          ...raw.compare,
          category: {
            slug: raw.compare.category.slug,
            name: asLocalizedText(raw.compare.category.name) ?? { en: raw.compare.category.slug },
          },
          views: {
            mine: Number(raw.compare.views.mine),
            typical: Number(raw.compare.views.typical),
          },
          inquiries: {
            mine: Number(raw.compare.inquiries.mine),
            typical: Number(raw.compare.inquiries.typical),
          },
        }
      : null,
  };
}

/**
 * The share of one step of the funnel that reached the next, as a whole
 * percent (views → saves …), or null when the step before was 0.
 */
export function stepRate(from: number, to: number): number | null {
  if (from <= 0) return null;
  return Math.round((to / from) * 100);
}

/** A reply time in plain words' parts: under an hour in minutes, then hours, then days. */
export function replyTime(minutes: number): { unit: 'minutes' | 'hours' | 'days'; count: number } {
  if (minutes < 60) return { unit: 'minutes', count: Math.max(1, Math.round(minutes)) };
  if (minutes < 48 * 60) return { unit: 'hours', count: Math.round(minutes / 60) };
  return { unit: 'days', count: Math.round(minutes / (24 * 60)) };
}

/** Worth a gentle nudge: replying to fewer than 8 in 10, or usually after a day. */
export function needsReplyNudge(replies: Replies): boolean {
  if (replies.leads === 0) return false;
  return (
    (replies.rate !== null && replies.rate < 0.8) ||
    (replies.medianMinutes !== null && replies.medianMinutes > 24 * 60)
  );
}

/** The busiest day in the period, for the chart's scale and a headline. */
export function busiestDay(daily: DailyNumbers[]): DailyNumbers | null {
  return daily.reduce<DailyNumbers | null>(
    (best, d) => (best === null || d.views > best.views ? d : best),
    null,
  );
}

/**
 * Everything for the insights screen over the last 7, 30 or 90 days. Fresh
 * for 5 minutes.
 */
export function useBusinessInsights(vendorId: string, days: StatsPeriod) {
  const today = californiaToday();
  return useQuery({
    queryKey: insightKeys.insights(vendorId, days, today),
    queryFn: async () => {
      const { current } = statsPeriods(days, today);
      const { data, error } = await supabase.rpc('business_insights', {
        p_vendor_id: vendorId,
        p_from: current.from,
        p_to: current.to,
      });
      if (error) throw error;
      return toInsights(data as unknown as Raw);
    },
    enabled: vendorId.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

// Reels ------------------------------------------------------------------------------------

export type BusinessReel = {
  id: string;
  thumbUrl: string | null;
  caption: string | null;
  createdAt: string;
  /** Their own reel; false when a family tagged them in it */
  own: boolean;
  views: number;
  likes: number;
  comments: number;
};

export function toBusinessReel(row: {
  id: string;
  thumb_path: string | null;
  caption: string | null;
  created_at: string;
  own: boolean;
  views: number;
  likes: number;
  comments: number;
}): BusinessReel {
  return {
    id: row.id,
    thumbUrl: row.thumb_path ? reelFileUrl(row.thumb_path) : null,
    caption: row.caption,
    createdAt: row.created_at,
    own: row.own,
    views: row.views,
    likes: row.likes,
    comments: row.comments,
  };
}

/** Their live reels and the ones they're tagged in, newest first, with views, likes and comments. */
export function useBusinessReels(vendorId: string) {
  return useQuery({
    queryKey: insightKeys.reels(vendorId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('business_reels', { p_vendor_id: vendorId });
      if (error) throw error;
      return data.map(toBusinessReel);
    },
    enabled: vendorId.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

// Listing checklist ------------------------------------------------------------------------

export type ChecklistKey =
  | 'photos'
  | 'cover'
  | 'tagline'
  | 'bio'
  | 'bioPa'
  | 'price'
  | 'contact'
  | 'instagram'
  | 'languages'
  | 'calendar'
  | 'reel'
  | 'menus';

export type ChecklistItem = { key: ChecklistKey; done: boolean; count?: number };

/** The order the checklist reads in: what helps most first. */
export const CHECKLIST_ORDER: ChecklistKey[] = [
  'photos',
  'cover',
  'price',
  'contact',
  'calendar',
  'menus',
  'tagline',
  'bio',
  'bioPa',
  'languages',
  'reel',
  'instagram',
];

export function toChecklist(rows: { key: string; done: boolean; count: number | null }[]) {
  const items = rows
    .filter((row): row is typeof row & { key: ChecklistKey } =>
      CHECKLIST_ORDER.includes(row.key as ChecklistKey),
    )
    .map((row): ChecklistItem => ({
      key: row.key,
      done: row.done,
      ...(row.count !== null ? { count: row.count } : {}),
    }))
    // Missing ones first, then in order of what helps most
    .sort(
      (a, b) =>
        Number(a.done) - Number(b.done) ||
        CHECKLIST_ORDER.indexOf(a.key) - CHECKLIST_ORDER.indexOf(b.key),
    );
  return {
    items,
    doneCount: items.filter((item) => item.done).length,
    total: items.length,
  };
}

/** What their listing has and is missing, missing first. */
export function useBusinessChecklist(vendorId: string) {
  return useQuery({
    queryKey: insightKeys.checklist(vendorId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('business_checklist', { p_vendor_id: vendorId });
      if (error) throw error;
      return toChecklist(data);
    },
    enabled: vendorId.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

// Search appearances -----------------------------------------------------------------------

const appeared = new Set<string>();

/**
 * Count vendors showing up in a list of search results, each once per app
 * session. Call it when results show. Fire and forget: it never throws.
 */
export function trackSearchAppearances(vendorIds: string[]): void {
  const fresh = [...new Set(vendorIds)].filter((id) => id && !appeared.has(id));
  if (fresh.length === 0) return;
  fresh.forEach((id) => appeared.add(id));
  for (let i = 0; i < fresh.length; i += 50) {
    void supabase.rpc('track_search_appearances', { p_vendor_ids: fresh.slice(i, i + 50) }).then(
      () => undefined,
      () => undefined,
    );
  }
}
