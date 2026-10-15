/**
 * Requests and proposals (R1, #218; plan #217). A family posts a Request (what
 * they're looking for, filled from their plan); vendors on Wedded Pro see open
 * requests that fit them in Families looking and send one proposal each; the
 * family accepts one (opening the chat) or declines. Free vendors only get
 * counts. Vendors see the short name and town, never contact details (see the
 * requests migration).
 */
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { asLocalizedText, type LocalizedText } from '@/i18n/localized';
import { supabase } from '@/lib/supabase';

import { chatKeys } from './chat';
import { photoUrl } from './vendor-media';

export const requestKeys = {
  all: ['requests'] as const,
  mine: (weddingId: string) => [...requestKeys.all, 'mine', weddingId] as const,
  proposals: (requestId: string) => [...requestKeys.all, 'proposals', requestId] as const,
  looking: (vendorId: string, filters: LookingFilters) =>
    [...requestKeys.all, 'looking', vendorId, filters] as const,
  summary: (vendorId: string) => [...requestKeys.all, 'summary', vendorId] as const,
  myProposals: (vendorId: string) => [...requestKeys.all, 'my-proposals', vendorId] as const,
  pro: (vendorId: string) => [...requestKeys.all, 'pro', vendorId] as const,
};

export type RequestStatus = 'open' | 'booked' | 'closed';
export type ProposalStatus = 'sent' | 'accepted' | 'declined' | 'withdrawn';
export type ProposalUnit = 'event' | 'hour' | 'person' | 'plate' | 'day';

// Problems --------------------------------------------------------------------------------

export type RequestProblem =
  | 'notAllowed'
  | 'proOnly'
  | 'alreadyOpen'
  | 'tooManyOpen'
  | 'rate'
  | 'datePassed'
  | 'invalid'
  | 'notOpen'
  | 'alreadySent'
  | 'proposalsFull'
  | 'alreadyAnswered'
  | 'offline'
  | 'failed';

/** A refused post, proposal or answer, in terms a screen can word. */
export function requestProblem(error: unknown): RequestProblem {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (message.includes('pro_only')) return 'proOnly';
  if (message.includes('already_open')) return 'alreadyOpen';
  if (message.includes('too_many_open')) return 'tooManyOpen';
  if (message.includes('request_rate') || message.includes('proposal_rate')) return 'rate';
  if (message.includes('date_passed')) return 'datePassed';
  if (message.includes('not_open')) return 'notOpen';
  if (message.includes('already_sent')) return 'alreadySent';
  if (message.includes('proposals_full')) return 'proposalsFull';
  if (message.includes('already_answered')) return 'alreadyAnswered';
  if (message.includes('not_allowed')) return 'notAllowed';
  if (/invalid_(category|event|city|note|budget|price|menu|reel)/.test(message)) return 'invalid';
  if (/network request failed|failed to fetch/i.test(message)) return 'offline';
  return 'failed';
}

// Families: posting -----------------------------------------------------------------------

export type NewRequest = {
  categorySlug: string;
  /** What they wrote; required */
  note: string;
  /** A town from `cities` (matchCities), usually the family's city */
  citySlug: string;
  eventSlug?: string | null;
  /** yyyy-mm-dd: the event's date from the plan, else the wedding's */
  eventDate?: string | null;
  /** The inquiry guest bands: under_50, 50_100, 100_250, 250_500, 500_plus, not_sure */
  guestBand?: string | null;
  budgetMinCents?: number | null;
  budgetMaxCents?: number | null;
};

/** Post a request to Pro vendors (owners and editors of the wedding). Returns its id. */
export function usePostRequest(weddingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: NewRequest) => {
      const { data, error } = await supabase.rpc('post_request', {
        p_wedding_id: weddingId,
        p_category_slug: request.categorySlug,
        p_note: request.note.trim(),
        p_city_slug: request.citySlug,
        p_event_slug: request.eventSlug ?? undefined,
        p_event_date: request.eventDate ?? undefined,
        p_guest_band: request.guestBand ?? undefined,
        p_budget_min_cents: request.budgetMinCents ?? undefined,
        p_budget_max_cents: request.budgetMaxCents ?? undefined,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: requestKeys.mine(weddingId) }),
  });
}

export type WeddingRequest = {
  id: string;
  categorySlug: string;
  eventSlug: string | null;
  eventDate: string | null;
  guestBand: string | null;
  budgetMinCents: number | null;
  budgetMaxCents: number | null;
  note: string;
  citySlug: string;
  status: RequestStatus;
  /** Open, but its date (or 90 days) has passed */
  expired: boolean;
  proposalCount: number;
  createdAt: string;
};

type RequestRow = {
  id: string;
  category_slug: string;
  event_slug: string | null;
  event_date: string | null;
  guest_band: string | null;
  budget_min_cents: number | null;
  budget_max_cents: number | null;
  note: string;
  city_slug: string;
  status: string;
  proposal_count: number;
  expires_at: string;
  created_at: string;
};

export function toRequest(row: RequestRow, now: Date = new Date()): WeddingRequest {
  const status: RequestStatus =
    row.status === 'booked' || row.status === 'closed' ? row.status : 'open';
  return {
    id: row.id,
    categorySlug: row.category_slug,
    eventSlug: row.event_slug,
    eventDate: row.event_date,
    guestBand: row.guest_band,
    budgetMinCents: row.budget_min_cents,
    budgetMaxCents: row.budget_max_cents,
    note: row.note,
    citySlug: row.city_slug,
    status,
    expired: status === 'open' && new Date(row.expires_at) <= now,
    proposalCount: row.proposal_count,
    createdAt: row.created_at,
  };
}

/** The wedding's requests, newest first. */
export function useMyRequests(weddingId: string) {
  return useQuery({
    queryKey: requestKeys.mine(weddingId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wedding_requests')
        .select(
          'id, category_slug, event_slug, event_date, guest_band, budget_min_cents, budget_max_cents, note, city_slug, status, proposal_count, expires_at, created_at',
        )
        .eq('wedding_id', weddingId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as RequestRow[]).map((row) => toRequest(row));
    },
    enabled: weddingId.length > 0,
  });
}

/** Stop a request taking proposals: booked (they found someone) or just closed. */
export function useCloseRequest(weddingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId, booked }: { requestId: string; booked: boolean }) => {
      const { error } = await supabase.rpc('close_request', {
        p_request_id: requestId,
        p_booked: booked,
      });
      if (error) throw new Error(error.message);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: requestKeys.mine(weddingId) }),
  });
}

// Families: proposals ---------------------------------------------------------------------

export type Proposal = {
  id: string;
  vendor: {
    id: string;
    slug: string;
    name: LocalizedText;
    city: string;
    photoUrl: string | null;
    foundingNumber: number | null;
  };
  priceCents: number | null;
  priceUnit: ProposalUnit | null;
  note: string;
  menuId: string | null;
  reelId: string | null;
  status: ProposalStatus;
  /** The chat it opened, once accepted */
  conversationId: string | null;
  createdAt: string;
};

type ProposalRow = {
  id: string;
  vendor_id: string;
  vendor_slug: string;
  vendor_name: string;
  vendor_city: string;
  cover_path: string | null;
  founding_number: number | null;
  price_cents: number | null;
  price_unit: string | null;
  note: string;
  menu_id: string | null;
  reel_id: string | null;
  status: string;
  conversation_id: string | null;
  created_at: string;
};

const UNITS: ProposalUnit[] = ['event', 'hour', 'person', 'plate', 'day'];
const PROPOSAL_STATUSES: ProposalStatus[] = ['sent', 'accepted', 'declined', 'withdrawn'];

export function toProposal(row: ProposalRow): Proposal {
  return {
    id: row.id,
    vendor: {
      id: row.vendor_id,
      slug: row.vendor_slug,
      name: { en: row.vendor_name },
      city: row.vendor_city,
      photoUrl: row.cover_path ? photoUrl(row.cover_path, 'medium') : null,
      foundingNumber: row.founding_number,
    },
    priceCents: row.price_cents,
    priceUnit: UNITS.find((u) => u === row.price_unit) ?? null,
    note: row.note,
    menuId: row.menu_id,
    reelId: row.reel_id,
    status: PROPOSAL_STATUSES.find((s) => s === row.status) ?? 'sent',
    conversationId: row.conversation_id,
    createdAt: row.created_at,
  };
}

/** The proposals on one of the family's requests: accepted first, then oldest first. */
export function useRequestProposals(requestId: string) {
  return useQuery({
    queryKey: requestKeys.proposals(requestId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('request_proposals_for', {
        p_request_id: requestId,
      });
      if (error) throw error;
      return (data as ProposalRow[]).map(toProposal);
    },
    enabled: requestId.length > 0,
  });
}

/**
 * Accept (returns the chat to open, with the proposal in it) or decline.
 * Owners and editors of the wedding.
 */
export function useAnswerProposal(requestId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ proposalId, accept }: { proposalId: string; accept: boolean }) => {
      const { data, error } = await supabase.rpc('answer_proposal', {
        p_proposal_id: proposalId,
        p_accept: accept,
      });
      if (error) throw new Error(error.message);
      return { conversationId: (data as string | null) ?? null };
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: requestKeys.proposals(requestId) });
      void queryClient.invalidateQueries({ queryKey: chatKeys.all });
    },
  });
}

// Vendors: Families looking ---------------------------------------------------------------

export type LookingFilters = {
  /** One of the vendor's types; all of them when left out */
  categorySlug?: string | null;
  /** How far from the vendor; at least their own travel area. Default 50. */
  maxMiles?: number;
  /** yyyy-mm-dd range of event dates */
  from?: string | null;
  to?: string | null;
};

export type LookingCard = {
  id: string;
  /** "Harjit K." — never a full name */
  familyName: string;
  city: string;
  categorySlug: string;
  categoryName: LocalizedText;
  eventSlug: string | null;
  eventName: LocalizedText | null;
  eventDate: string | null;
  guestBand: string | null;
  budgetMinCents: number | null;
  budgetMaxCents: number | null;
  note: string;
  miles: number;
  proposalCount: number;
  /** 10 proposals already: no more can be sent */
  proposalsFull: boolean;
  alreadyProposed: boolean;
  /** From the vendor's calendar on the event date */
  dateStatus: 'open' | 'booked' | 'held' | 'partly' | 'unknown';
  postedAt: string;
};

type LookingRow = {
  id: string;
  family_name: string;
  city: string;
  category_slug: string;
  category_name: unknown;
  event_slug: string | null;
  event_name: unknown;
  event_date: string | null;
  guest_band: string | null;
  budget_min_cents: number | null;
  budget_max_cents: number | null;
  note: string;
  miles: number | string;
  proposal_count: number;
  proposals_full: boolean;
  already_proposed: boolean;
  date_status: string;
  created_at: string;
};

const DATE_STATUSES: LookingCard['dateStatus'][] = ['open', 'booked', 'held', 'partly', 'unknown'];

export function toLookingCard(row: LookingRow): LookingCard {
  return {
    id: row.id,
    familyName: row.family_name,
    city: row.city,
    categorySlug: row.category_slug,
    categoryName: asLocalizedText(row.category_name) ?? { en: row.category_slug },
    eventSlug: row.event_slug,
    eventName: row.event_slug ? (asLocalizedText(row.event_name) ?? { en: row.event_slug }) : null,
    eventDate: row.event_date,
    guestBand: row.guest_band,
    budgetMinCents: row.budget_min_cents,
    budgetMaxCents: row.budget_max_cents,
    note: row.note,
    miles: Number(row.miles),
    proposalCount: row.proposal_count,
    proposalsFull: row.proposals_full,
    alreadyProposed: row.already_proposed,
    dateStatus: DATE_STATUSES.find((s) => s === row.date_status) ?? 'unknown',
    postedAt: row.created_at,
  };
}

const PAGE = 20;

/** Wedded Pro: open requests that fit the vendor, newest first, 20 at a time. */
export function useFamiliesLooking(vendorId: string, filters: LookingFilters = {}) {
  return useInfiniteQuery({
    queryKey: requestKeys.looking(vendorId, filters),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc('families_looking', {
        p_vendor_id: vendorId,
        p_category_slug: filters.categorySlug ?? undefined,
        p_max_miles: filters.maxMiles ?? 50,
        p_from: filters.from ?? undefined,
        p_to: filters.to ?? undefined,
        p_before: pageParam ?? undefined,
        p_limit: PAGE,
      });
      if (error) throw new Error(error.message);
      return (data as LookingRow[]).map(toLookingCard);
    },
    getNextPageParam: (last) => (last.length < PAGE ? null : last[last.length - 1].postedAt),
    enabled: vendorId.length > 0,
  });
}

export type LookingSummary = {
  /** Open requests near them in all their vendor types */
  total: number;
  byCategory: { categorySlug: string; categoryName: LocalizedText; count: number }[];
};

/** How many families nearby are looking for what they do (the free teaser). */
export function useFamiliesLookingSummary(vendorId: string) {
  return useQuery({
    queryKey: requestKeys.summary(vendorId),
    queryFn: async (): Promise<LookingSummary> => {
      const { data, error } = await supabase.rpc('families_looking_summary', {
        p_vendor_id: vendorId,
      });
      if (error) throw error;
      const byCategory = (
        data as { category_slug: string; category_name: unknown; open_requests: number }[]
      ).map((row) => ({
        categorySlug: row.category_slug,
        categoryName: asLocalizedText(row.category_name) ?? { en: row.category_slug },
        count: row.open_requests,
      }));
      return { total: byCategory.reduce((sum, c) => sum + c.count, 0), byCategory };
    },
    enabled: vendorId.length > 0,
  });
}

export type NewProposal = {
  requestId: string;
  note: string;
  /** Together with priceUnit, or neither */
  priceCents?: number | null;
  priceUnit?: ProposalUnit | null;
  menuId?: string | null;
  reelId?: string | null;
};

/** Wedded Pro: send one proposal to a request. Returns its id. */
export function useSendProposal(vendorId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (proposal: NewProposal) => {
      const { data, error } = await supabase.rpc('send_proposal', {
        p_request_id: proposal.requestId,
        p_vendor_id: vendorId,
        p_note: proposal.note.trim(),
        p_price_cents: proposal.priceCents ?? undefined,
        p_price_unit: proposal.priceUnit ?? undefined,
        p_menu_id: proposal.menuId ?? undefined,
        p_reel_id: proposal.reelId ?? undefined,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: [...requestKeys.all, 'looking', vendorId] });
      void queryClient.invalidateQueries({ queryKey: requestKeys.myProposals(vendorId) });
    },
  });
}

/** Take back a proposal the family hasn't answered. */
export function useWithdrawProposal(vendorId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (proposalId: string) => {
      const { error } = await supabase.rpc('withdraw_proposal', { p_proposal_id: proposalId });
      if (error) throw new Error(error.message);
    },
    onSettled: () =>
      void queryClient.invalidateQueries({ queryKey: requestKeys.myProposals(vendorId) }),
  });
}

export type SentProposal = {
  id: string;
  requestId: string;
  priceCents: number | null;
  priceUnit: ProposalUnit | null;
  note: string;
  status: ProposalStatus;
  conversationId: string | null;
  createdAt: string;
  answeredAt: string | null;
};

/** The proposals this vendor sent, newest first, with whether families answered. */
export function useMyProposals(vendorId: string) {
  return useQuery({
    queryKey: requestKeys.myProposals(vendorId),
    queryFn: async (): Promise<SentProposal[]> => {
      const { data, error } = await supabase
        .from('request_proposals')
        .select(
          'id, request_id, price_cents, price_unit, note, status, conversation_id, created_at, answered_at',
        )
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data.map((row) => ({
        id: row.id,
        requestId: row.request_id,
        priceCents: row.price_cents,
        priceUnit: UNITS.find((u) => u === row.price_unit) ?? null,
        note: row.note,
        status: PROPOSAL_STATUSES.find((s) => s === row.status) ?? 'sent',
        conversationId: row.conversation_id,
        createdAt: row.created_at,
        answeredAt: row.answered_at,
      }));
    },
    enabled: vendorId.length > 0,
  });
}

// Wedded Pro status -------------------------------------------------------------------------

export type ProStatus = {
  plan: 'pro' | 'free';
  /** When the paid month ends (renews, or stops if canceled) */
  renewsOn: string | null;
  cancelAtPeriodEnd: boolean;
  /** A renewal failed; Pro stays on for a few days while they fix the card */
  pastDue: boolean;
};

const FREE: ProStatus = { plan: 'free', renewsOn: null, cancelAtPeriodEnd: false, pastDue: false };

/** Pro while the subscription is paid up; a failed renewal keeps it 3 more days. */
export function proStatusOf(
  row: { status: string; current_period_end: string | null; cancel_at_period_end: boolean } | null,
  now: Date = new Date(),
): ProStatus {
  if (!row) return FREE;
  const end = row.current_period_end ? new Date(row.current_period_end) : null;
  const pastDue = row.status === 'past_due';
  const graceOk =
    pastDue && end !== null && end.getTime() > now.getTime() - 3 * 24 * 60 * 60 * 1000;
  const pro = row.status === 'active' || row.status === 'trialing' || graceOk;
  return pro
    ? {
        plan: 'pro',
        renewsOn: row.current_period_end,
        cancelAtPeriodEnd: row.cancel_at_period_end,
        pastDue,
      }
    : FREE;
}

/** Whether this vendor is on Wedded Pro. */
export function useProStatus(vendorId: string) {
  return useQuery({
    queryKey: requestKeys.pro(vendorId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendor_subscriptions')
        .select('status, current_period_end, cancel_at_period_end')
        .eq('vendor_id', vendorId)
        .maybeSingle();
      if (error) throw error;
      return proStatusOf(data);
    },
    enabled: vendorId.length > 0,
  });
}
