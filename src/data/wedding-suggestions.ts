/**
 * Suggestions on a shared plan (like suggesting in Google Docs): a member
 * suggests a vendor for one of the wedding's events and vendor types, and
 * the owner or an editor accepts it (the vendor is booked in the plan) or
 * declines it. Suggesters can only suggest; editors can suggest too.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { weddingKeys } from '@/data/wedding';
import type { LocalizedText } from '@/i18n/localized';
import { supabase } from '@/lib/supabase';

export type SuggestionStatus = 'open' | 'accepted' | 'declined';

export type WeddingSuggestion = {
  id: string;
  eventSlug: string;
  categorySlug: string;
  note: string | null;
  status: SuggestionStatus;
  suggestedBy: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  /** Null once the vendor is no longer listed. */
  vendor: { id: string; slug: string; name: LocalizedText } | null;
};

type Row = {
  id: string;
  event_slug: string;
  category_slug: string;
  note: string | null;
  status: string;
  suggested_by: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  vendor: { id: string; slug: string; name: string } | null;
};

export function toSuggestion(row: Row): WeddingSuggestion {
  return {
    id: row.id,
    eventSlug: row.event_slug,
    categorySlug: row.category_slug,
    note: row.note,
    status: row.status === 'accepted' || row.status === 'declined' ? row.status : 'open',
    suggestedBy: row.suggested_by,
    resolvedBy: row.resolved_by,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    vendor: row.vendor
      ? {
          id: row.vendor.id,
          slug: row.vendor.slug,
          name: { en: row.vendor.name },
        }
      : null,
  };
}

/** Decided suggestions stay on the list this long, so people see what happened. */
export const RECENT_DAYS = 14;

/**
 * What the plan shows: every open suggestion (oldest first, so nothing waits
 * forever), then the ones decided in the last two weeks, most recently
 * decided first.
 */
export function orderSuggestions(list: WeddingSuggestion[], now = new Date()): WeddingSuggestion[] {
  const since = now.getTime() - RECENT_DAYS * 24 * 60 * 60 * 1000;
  const open = list
    .filter((s) => s.status === 'open')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const decidedAt = (s: WeddingSuggestion) => s.resolvedAt ?? s.createdAt;
  const decided = list
    .filter((s) => s.status !== 'open' && new Date(decidedAt(s)).getTime() >= since)
    .sort((a, b) => decidedAt(b).localeCompare(decidedAt(a)));
  return [...open, ...decided];
}

/** Open suggestions per "event/category", for the counts on the plan's checklist. */
export function openCounts(list: WeddingSuggestion[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const s of list) {
    if (s.status !== 'open') continue;
    const key = `${s.eventSlug}/${s.categorySlug}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export type SuggestError = 'notAllowed' | 'eventNotInPlan' | 'vendorGone' | 'limit' | 'failed';

/** Which message to show when suggesting fails (the database's error names). */
export function suggestErrorKind(error: unknown): SuggestError {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (message.includes('not_allowed')) return 'notAllowed';
  if (message.includes('event_not_in_plan')) return 'eventNotInPlan';
  if (message.includes('vendor_not_found') || message.includes('category_not_found')) {
    return 'vendorGone';
  }
  if (message.includes('suggestion_limit')) return 'limit';
  return 'failed';
}

const suggestionKeys = {
  list: (weddingId: string) => ['wedding-suggestions', weddingId] as const,
};

/** A shared plan's suggestions, as orderSuggestions() puts them. */
export function useWeddingSuggestions(weddingId: string | null) {
  return useQuery({
    queryKey: suggestionKeys.list(weddingId ?? ''),
    queryFn: async (): Promise<WeddingSuggestion[]> => {
      const { data, error } = await supabase
        .from('wedding_suggestions')
        .select(
          'id, event_slug, category_slug, note, status, suggested_by, resolved_by, resolved_at, created_at, vendor:vendors(id, slug, name)',
        )
        .eq('wedding_id', weddingId ?? '')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return orderSuggestions((data as Row[]).map(toSuggestion));
    },
    enabled: !!weddingId,
  });
}

export type SuggestionDraft = {
  weddingId: string;
  eventSlug: string;
  categorySlug: string;
  vendorId: string;
  note?: string;
};

export function useSuggestVendor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (draft: SuggestionDraft): Promise<string> => {
      const { data, error } = await supabase.rpc('suggest_vendor', {
        p_wedding_id: draft.weddingId,
        p_event_slug: draft.eventSlug,
        p_category_slug: draft.categorySlug,
        p_vendor_id: draft.vendorId,
        p_note: draft.note?.trim() || undefined,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_id, { weddingId }) =>
      queryClient.invalidateQueries({ queryKey: suggestionKeys.list(weddingId) }),
  });
}

/** Accept (books the vendor in the plan) or decline. The owner and editors only. */
export function useResolveSuggestion(weddingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, accept }: { id: string; accept: boolean }) => {
      const { error } = await supabase.rpc('resolve_suggestion', {
        p_suggestion_id: id,
        p_accept: accept,
      });
      if (error) throw new Error(error.message);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: suggestionKeys.list(weddingId) });
      // Accepting changed the plan's bookings
      void queryClient.invalidateQueries({ queryKey: weddingKeys.all });
    },
  });
}

/** Take back your own open suggestion. */
export function useWithdrawSuggestion(weddingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('withdraw_suggestion', { p_suggestion_id: id });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: suggestionKeys.list(weddingId) }),
  });
}
