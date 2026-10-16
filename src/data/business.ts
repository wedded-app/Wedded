/**
 * My business (C6, #146): what a vendor's own people see about their listing.
 * The businesses they run, their numbers for a period next to the period
 * before, their leads (the inquiries families sent) and reel view counting.
 * Only the vendor's members can read any of it (see the my_business migration).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/features/auth/session';
import { supabase } from '@/lib/supabase';

import { chatKeys } from './chat';

export const businessKeys = {
  all: ['business'] as const,
  mine: (userId: string) => [...businessKeys.all, 'mine', userId] as const,
  stats: (vendorId: string, days: number, today: string) =>
    [...businessKeys.all, 'stats', vendorId, days, today] as const,
  leads: (vendorId: string) => [...businessKeys.all, 'leads', vendorId] as const,
};

// The businesses I run ----------------------------------------------------------------------

export type Business = {
  id: string;
  slug: string;
  name: string;
  /** draft, published, … (vendors.status) */
  status: string;
  role: 'owner' | 'staff';
};

export function toBusiness(row: {
  id: string;
  slug: string;
  name: string;
  status: string;
  role: string;
}): Business {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    role: row.role === 'staff' ? 'staff' : 'owner',
  };
}

/** The vendors the signed-in person runs, A to Z, drafts included (usually none). */
export function useMyBusinesses() {
  const { session } = useSession();
  const userId = session?.user.id ?? '';
  const query = useQuery({
    queryKey: businessKeys.mine(userId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_businesses');
      if (error) throw error;
      return data.map(toBusiness);
    },
    enabled: userId.length > 0,
    staleTime: 10 * 60 * 1000,
  });
  return {
    businesses: query.data ?? [],
    /** Still checking (signed in, not answered yet). */
    isPending: userId.length > 0 && query.isPending,
    error: query.error,
  };
}

// Signing a business up (R5, #222) -------------------------------------------------------

export type NewBusiness = {
  name: string;
  /** A vendor type from `categories` */
  categorySlug: string;
  /** A town from `cities` (matchCities) */
  citySlug: string;
};

export type StartBusinessError = 'needsProfile' | 'tooMany' | 'invalid' | 'offline' | 'failed';

/** What went wrong, from start_my_business's error message. */
export function startBusinessErrorKind(message: string): StartBusinessError {
  if (message.includes('needs_profile')) return 'needsProfile';
  if (message.includes('too_many_drafts')) return 'tooMany';
  if (/invalid_(name|category|city)/.test(message)) return 'invalid';
  if (/network request failed|failed to fetch/i.test(message)) return 'offline';
  return 'failed';
}

/**
 * "Wedding business" at sign-up: makes an unpublished listing the person owns (after About
 * you), or returns their draft of the same name. A founder publishes it. Returns its id and slug.
 */
export function useStartMyBusiness() {
  const queryClient = useQueryClient();
  const { session } = useSession();
  return useMutation({
    mutationFn: async (business: NewBusiness) => {
      const { data, error } = await supabase.rpc('start_my_business', {
        p_name: business.name.trim(),
        p_category_slug: business.categorySlug,
        p_city_slug: business.citySlug,
      });
      if (error) throw new Error(error.message);
      return data as { vendorId: string; slug: string };
    },
    // Awaited, so the business tabs open knowing about the new listing
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: businessKeys.all }),
        queryClient.invalidateQueries({ queryKey: chatKeys.vendor(session?.user.id ?? '') }),
      ]),
  });
}

// Numbers ----------------------------------------------------------------------------------

export type StatsPeriod = 7 | 30 | 90;

export type BusinessStats = {
  /** People who opened the vendor's page (each once per app session) */
  views: number;
  calls: number;
  texts: number;
  whatsapps: number;
  directions: number;
  instagram: number;
  website: number;
  shares: number;
  /** Every contact tap added up: calls, texts, WhatsApps, directions, Instagram, website */
  contacts: number;
  saves: number;
  inquiries: number;
  /** Views of the vendor's own reels and the ones they're tagged in */
  reelViews: number;
};

export const EMPTY_STATS: BusinessStats = {
  views: 0,
  calls: 0,
  texts: 0,
  whatsapps: 0,
  directions: 0,
  instagram: 0,
  website: 0,
  shares: 0,
  contacts: 0,
  saves: 0,
  inquiries: 0,
  reelViews: 0,
};

/** Today in California as yyyy-mm-dd, the day the counts are kept by. */
export function californiaToday(now: Date = new Date()): string {
  // en-CA writes dates as yyyy-mm-dd
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * The last `days` days up to today, and the same number of days just before,
 * as inclusive yyyy-mm-dd ranges.
 */
export function statsPeriods(days: StatsPeriod, today: string) {
  return {
    current: { from: addDays(today, -(days - 1)), to: today },
    previous: { from: addDays(today, -(2 * days - 1)), to: addDays(today, -days) },
  };
}

/**
 * How much a number moved from the period before, as a whole percent, or null
 * when there's nothing to compare with (the period before was 0).
 */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

type StatsRow = {
  views: number;
  calls: number;
  texts: number;
  whatsapps: number;
  directions: number;
  instagram: number;
  website: number;
  shares: number;
  contacts: number;
  saves: number;
  inquiries: number;
  reel_views: number;
};

export function toStats(row: StatsRow | undefined): BusinessStats {
  if (!row) return EMPTY_STATS;
  const { reel_views, ...rest } = row;
  return { ...rest, reelViews: reel_views };
}

async function fetchStats(vendorId: string, range: { from: string; to: string }) {
  const { data, error } = await supabase.rpc('business_stats', {
    p_vendor_id: vendorId,
    p_from: range.from,
    p_to: range.to,
  });
  if (error) throw error;
  return toStats(data[0]);
}

/**
 * A vendor's numbers for the last 7, 30 or 90 days (`current`) and the period
 * just before (`previous`), for "up 20%". Fresh for 5 minutes.
 */
export function useBusinessStats(vendorId: string, days: StatsPeriod) {
  const today = californiaToday();
  return useQuery({
    queryKey: businessKeys.stats(vendorId, days, today),
    queryFn: async () => {
      const periods = statsPeriods(days, today);
      const [current, previous] = await Promise.all([
        fetchStats(vendorId, periods.current),
        fetchStats(vendorId, periods.previous),
      ]);
      return { current, previous };
    },
    enabled: vendorId.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

// Leads ------------------------------------------------------------------------------------

export type Lead = {
  id: string;
  createdAt: string;
  /** "Harjit K.", or null once the family deleted their account */
  familyName: string | null;
  eventSlugs: string[];
  /** yyyy-mm-dd, or null for "Not sure yet" */
  eventDate: string | null;
  /** hh:mm:ss, when they gave one */
  startTime: string | null;
  /** The inquiry's guest band: under_50, 50_100, 100_250, 250_500, 500_plus or not_sure */
  guestBand: string;
  location: string;
  message: string;
  /** The answers to the vendor type's questions (see features/inquiry/details.ts) */
  details: Record<string, unknown>;
  kind: 'inquiry' | 'tour';
  preferredContact: 'call' | 'text' | 'whatsapp' | 'email';
  /** E.164, as the family sent it with the inquiry; null once their account is deleted */
  phone: string | null;
  /** Only when they asked to be emailed */
  email: string | null;
  /** The family's chat with the vendor, when there is one */
  conversationId: string | null;
  /** The vendor has sent a message in that chat since the lead came in */
  replied: boolean;
};

type LeadRow = {
  id: string;
  created_at: string;
  family_name: string | null;
  event_slugs: string[];
  event_date: string | null;
  start_time: string | null;
  guest_band: string;
  location: string;
  message: string;
  details: unknown;
  is_tour: boolean;
  preferred_contact: string;
  phone: string | null;
  email: string | null;
  conversation_id: string | null;
  replied: boolean;
};

const CONTACTS = ['call', 'text', 'whatsapp', 'email'] as const;

export function toLead(row: LeadRow): Lead {
  const details =
    row.details && typeof row.details === 'object' && !Array.isArray(row.details)
      ? (row.details as Record<string, unknown>)
      : {};
  return {
    id: row.id,
    createdAt: row.created_at,
    familyName: row.family_name,
    eventSlugs: row.event_slugs ?? [],
    eventDate: row.event_date,
    startTime: row.start_time,
    guestBand: row.guest_band,
    location: row.location,
    message: row.message,
    details,
    kind: row.is_tour ? 'tour' : 'inquiry',
    preferredContact: CONTACTS.find((c) => c === row.preferred_contact) ?? 'call',
    phone: row.phone,
    email: row.email,
    conversationId: row.conversation_id,
    replied: row.replied,
  };
}

/** Leads still waiting on a reply first (newest first), then the rest, newest first. */
export function orderLeads(leads: Lead[]): Lead[] {
  return [...leads].sort((a, b) => {
    if (a.replied !== b.replied) return a.replied ? 1 : -1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

/** How many leads are still waiting on a reply. */
export function waitingCount(leads: Lead[]): number {
  return leads.filter((lead) => !lead.replied).length;
}

/**
 * A vendor's latest 100 leads, waiting ones first. Refreshes every minute
 * while on screen, and when the app comes back to the front.
 */
export function useBusinessLeads(vendorId: string) {
  return useQuery({
    queryKey: businessKeys.leads(vendorId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('business_leads', {
        p_vendor_id: vendorId,
        p_limit: 100,
      });
      if (error) throw error;
      return orderLeads(data.map(toLead));
    },
    enabled: vendorId.length > 0,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });
}

// Reel views -------------------------------------------------------------------------------

const seenReels = new Set<string>();

/**
 * Count a reel view, once per reel per app session. Call it when a reel starts
 * playing. Fire and forget: it never throws.
 */
export function trackReelView(reelId: string): void {
  if (!reelId || seenReels.has(reelId)) return;
  seenReels.add(reelId);
  void supabase.rpc('track_reel_view', { p_reel_id: reelId }).then(
    () => undefined,
    () => undefined,
  );
}
