/**
 * Family shortlist (docs/RESEARCH_GROWTH.md #2): in a shared plan, every
 * vendor any family member saved, who saved it, and everyone's reactions
 * (love it / maybe / not for us). Members only; each person changes only
 * their own reaction.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { LocalizedText } from '@/i18n/localized';
import { supabase } from '@/lib/supabase';

export type Reaction = 'love' | 'maybe' | 'no';
export const REACTIONS: Reaction[] = ['love', 'maybe', 'no'];

export type ShortlistVendor = {
  vendorId: string;
  slug: string;
  name: LocalizedText;
  city: string;
  published: boolean;
  eventSlugs: string[];
  savedBy: string[];
  counts: Record<Reaction, number>;
  myReaction: Reaction | null;
  lovedBy: string[];
};

const shortlistKey = (weddingId: string) => ['wedding-shortlist', weddingId] as const;

function asReaction(value: string | null): Reaction | null {
  return value === 'love' || value === 'maybe' || value === 'no' ? value : null;
}

type Row = {
  vendor_id: string;
  slug: string;
  name: string;
  city: string;
  published: boolean;
  event_slugs: string[] | null;
  saved_by: string[] | null;
  loves: number;
  maybes: number;
  nos: number;
  my_reaction: string | null;
  loved_by: string[] | null;
};

export function toShortlistVendor(row: Row): ShortlistVendor {
  return {
    vendorId: row.vendor_id,
    slug: row.slug,
    name: { en: row.name },
    city: row.city,
    published: row.published,
    eventSlugs: row.event_slugs ?? [],
    savedBy: row.saved_by ?? [],
    counts: { love: row.loves, maybe: row.maybes, no: row.nos },
    myReaction: asReaction(row.my_reaction),
    lovedBy: row.loved_by ?? [],
  };
}

/** Change one vendor's counts and my reaction, for an instant update. */
export function withReaction(vendor: ShortlistVendor, next: Reaction | null): ShortlistVendor {
  const counts = { ...vendor.counts };
  if (vendor.myReaction) counts[vendor.myReaction] -= 1;
  if (next) counts[next] += 1;
  return { ...vendor, counts, myReaction: next };
}

export function useFamilyShortlist(weddingId: string | null) {
  return useQuery({
    queryKey: shortlistKey(weddingId ?? ''),
    queryFn: async (): Promise<ShortlistVendor[]> => {
      const { data, error } = await supabase.rpc('wedding_shortlist', {
        p_wedding_id: weddingId ?? '',
      });
      if (error) throw error;
      return (data as Row[]).map(toShortlistVendor);
    },
    enabled: !!weddingId,
  });
}

/** Set (or, with null, clear) my reaction to a vendor. Tapping the same one again clears it. */
export function useReact(weddingId: string) {
  const queryClient = useQueryClient();
  const key = shortlistKey(weddingId);
  return useMutation({
    mutationFn: async ({ vendorId, reaction }: { vendorId: string; reaction: Reaction | null }) => {
      const { data: auth } = await supabase.auth.getSession();
      const userId = auth.session?.user.id ?? '';
      const { error } = reaction
        ? await supabase.rpc('react_to_vendor', {
            p_wedding_id: weddingId,
            p_vendor_id: vendorId,
            p_reaction: reaction,
          })
        : await supabase
            .from('wedding_reactions')
            .delete()
            .eq('wedding_id', weddingId)
            .eq('vendor_id', vendorId)
            .eq('user_id', userId);
      if (error) throw error;
    },
    onMutate: async ({ vendorId, reaction }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ShortlistVendor[]>(key);
      queryClient.setQueryData<ShortlistVendor[]>(key, (list) =>
        list?.map((v) => (v.vendorId === vendorId ? withReaction(v, reaction) : v)),
      );
      return { previous };
    },
    onError: (_e, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}
