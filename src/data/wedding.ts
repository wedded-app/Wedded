/**
 * Plan together (docs/RESEARCH_GROWTH.md #1, vision S15b/S15c): My Wedding
 * saved to the account and shared with family. A wedding has members (owner,
 * planner, viewer); relatives join with an invite link sent in WhatsApp, which
 * opens in the app or on the web (/join/{token}).
 *
 * Planning needs an account (docs/DECISIONS.md, 2026-10-02): the first
 * questions create the wedding (useStartWedding). The account's copy is the
 * truth and the phone keeps a mirror of it (WeddingSync, mounted in the root
 * layout), so Home and Profile show it straight away; signing out clears it.
 */
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { useEffect } from 'react';
import { Platform, Share } from 'react-native';

import { SITE_URL_IS_PLACEHOLDER, siteLink } from '@/constants/links';
import { useSession } from '@/features/auth/session';
import {
  clearPlan,
  EMPTY_PLAN,
  isEmptyPlan,
  pickTradition,
  replacePlan,
  usePlan,
  type WeddingPlan,
} from '@/features/planner/plan';
import { supabase } from '@/lib/supabase';

export type WeddingRole = 'owner' | 'planner' | 'viewer';

/** A wedding the signed-in person is a member of, shaped like the phone's plan. */
export type AccountWedding = {
  id: string;
  title: string | null;
  weddingDate: string | null;
  role: WeddingRole;
  joinedAt: string;
  /** Culture slugs the family picked; empty means the default culture. */
  traditions: string[];
  events: string[];
  booked: Record<string, string[]>;
  guests: Record<string, string>;
  /** Who they booked, keyed "event/category", when a vendor is named. */
  bookedVendors: Record<string, { slug: string; name: string }>;
};

export const weddingKeys = {
  all: ['weddings'] as const,
  mine: (userId: string) => [...weddingKeys.all, userId] as const,
  members: (weddingId: string) => ['wedding-members', weddingId] as const,
  invite: (token: string) => ['wedding-invite', token] as const,
};

const ROLE_ORDER: Record<WeddingRole, number> = { owner: 0, planner: 1, viewer: 2 };

function isRole(value: string): value is WeddingRole {
  return value === 'owner' || value === 'planner' || value === 'viewer';
}

type MembershipRow = {
  role: string;
  joined_at: string;
  wedding: {
    id: string;
    title: string | null;
    wedding_date: string | null;
    traditions: string[] | null;
    wedding_events: {
      event_slug: string;
      guest_band: string | null;
      wedding_bookings: {
        category_slug: string;
        vendor: { slug: string; name: string } | null;
      }[];
    }[];
  } | null;
};

/** One membership row from the API as an AccountWedding (null if the wedding is gone). */
export function toAccountWedding(row: MembershipRow): AccountWedding | null {
  if (!row.wedding || !isRole(row.role)) return null;
  const booked: Record<string, string[]> = {};
  const guests: Record<string, string> = {};
  const bookedVendors: Record<string, { slug: string; name: string }> = {};
  for (const event of row.wedding.wedding_events) {
    for (const booking of event.wedding_bookings) {
      if (booking.vendor) {
        bookedVendors[`${event.event_slug}/${booking.category_slug}`] = booking.vendor;
      }
    }
    const categories = event.wedding_bookings.map((b) => b.category_slug);
    if (categories.length > 0) booked[event.event_slug] = categories;
    if (event.guest_band) guests[event.event_slug] = event.guest_band;
  }
  return {
    id: row.wedding.id,
    title: row.wedding.title,
    weddingDate: row.wedding.wedding_date,
    role: row.role,
    joinedAt: row.joined_at,
    traditions: row.wedding.traditions ?? [],
    events: row.wedding.wedding_events.map((e) => e.event_slug),
    booked,
    guests,
    bookedVendors,
  };
}

/** Their own weddings first (owner, then planner, then viewer), then the earliest joined. */
export function sortWeddings(weddings: AccountWedding[]): AccountWedding[] {
  return [...weddings].sort(
    (a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.joinedAt.localeCompare(b.joinedAt),
  );
}

/** The phone-plan shape of an account wedding. */
export function toPlan(wedding: AccountWedding): WeddingPlan {
  return {
    weddingDate: wedding.weddingDate,
    traditions: wedding.traditions,
    events: wedding.events,
    booked: wedding.booked,
    guests: wedding.guests,
    syncedWeddingId: wedding.id,
  };
}

async function fetchMyWeddings(userId: string): Promise<AccountWedding[]> {
  const { data, error } = await supabase
    .from('wedding_members')
    .select(
      'role, joined_at, wedding:weddings(id, title, wedding_date, traditions, wedding_events(event_slug, guest_band, wedding_bookings(category_slug, vendor:vendors(slug, name))))',
    )
    .eq('user_id', userId)
    .order('joined_at');
  if (error) throw error;
  return sortWeddings(
    (data as MembershipRow[]).map(toAccountWedding).filter((w): w is AccountWedding => !!w),
  );
}

/** The weddings the signed-in person belongs to, their own first. Empty when signed out. */
export function useMyWeddings() {
  const { session } = useSession();
  const userId = session?.user.id ?? '';
  return useQuery({
    queryKey: weddingKeys.mine(userId),
    queryFn: () => fetchMyWeddings(userId),
    enabled: userId.length > 0,
  });
}

/**
 * Keeps the phone's copy of My Wedding in step with the account: copies the
 * account's plan in when it changes, and clears it on sign-out or when the
 * account has no wedding, so a shared phone never shows the last person's
 * plan (or one made before planning needed an account). Renders nothing;
 * mounted once in the root layout.
 */
export function WeddingSync() {
  const { status } = useSession();
  const weddings = useMyWeddings();
  const wedding = weddings.data?.[0] ?? null;
  const plan = usePlan();

  useEffect(() => {
    if (wedding) replacePlan(toPlan(wedding));
  }, [wedding]);

  useEffect(() => {
    const gone = status === 'signedOut' || (weddings.isSuccess && weddings.data.length === 0);
    if (gone && !isEmptyPlan(plan)) clearPlan();
  }, [status, weddings.isSuccess, weddings.data, plan]);

  return null;
}

// Editing ------------------------------------------------------------------------------

export type WeddingChange =
  | { kind: 'date'; date: string | null }
  | { kind: 'traditions'; slugs: string[] }
  | { kind: 'event'; slug: string; on: boolean }
  | { kind: 'addEvents'; slugs: string[] }
  | { kind: 'booked'; event: string; category: string; on: boolean }
  | { kind: 'guests'; event: string; band: string | null };

/** The same change applied to the cached wedding, so the screen updates at once. */
export function applyChange(wedding: AccountWedding, change: WeddingChange): AccountWedding {
  switch (change.kind) {
    case 'date':
      return { ...wedding, weddingDate: change.date };
    case 'traditions':
      return { ...wedding, traditions: change.slugs };
    case 'addEvents':
      return {
        ...wedding,
        events: [...wedding.events, ...change.slugs.filter((s) => !wedding.events.includes(s))],
      };
    case 'event': {
      if (change.on) {
        return wedding.events.includes(change.slug)
          ? wedding
          : { ...wedding, events: [...wedding.events, change.slug] };
      }
      const booked = { ...wedding.booked };
      delete booked[change.slug];
      const guests = { ...wedding.guests };
      delete guests[change.slug];
      return {
        ...wedding,
        events: wedding.events.filter((e) => e !== change.slug),
        booked,
        guests,
      };
    }
    case 'booked': {
      const list = wedding.booked[change.event] ?? [];
      const next = change.on
        ? list.includes(change.category)
          ? list
          : [...list, change.category]
        : list.filter((c) => c !== change.category);
      return { ...wedding, booked: { ...wedding.booked, [change.event]: next } };
    }
    case 'guests': {
      const guests = { ...wedding.guests };
      if (change.band) guests[change.event] = change.band;
      else delete guests[change.event];
      return { ...wedding, guests };
    }
  }
}

async function saveChange(weddingId: string, change: WeddingChange): Promise<void> {
  let error: { message: string } | null = null;
  switch (change.kind) {
    case 'date':
      ({ error } = await supabase
        .from('weddings')
        .update({ wedding_date: change.date })
        .eq('id', weddingId));
      break;
    case 'traditions':
      ({ error } = await supabase
        .from('weddings')
        .update({ traditions: change.slugs })
        .eq('id', weddingId));
      break;
    case 'addEvents':
      ({ error } = await supabase.from('wedding_events').upsert(
        change.slugs.map((slug) => ({ wedding_id: weddingId, event_slug: slug })),
        { onConflict: 'wedding_id,event_slug', ignoreDuplicates: true },
      ));
      break;
    case 'event':
      ({ error } = change.on
        ? await supabase
            .from('wedding_events')
            .upsert(
              { wedding_id: weddingId, event_slug: change.slug },
              { onConflict: 'wedding_id,event_slug', ignoreDuplicates: true },
            )
        : await supabase
            .from('wedding_events')
            .delete()
            .eq('wedding_id', weddingId)
            .eq('event_slug', change.slug));
      break;
    case 'booked':
      ({ error } = change.on
        ? await supabase
            .from('wedding_bookings')
            .upsert(
              { wedding_id: weddingId, event_slug: change.event, category_slug: change.category },
              { onConflict: 'wedding_id,event_slug,category_slug', ignoreDuplicates: true },
            )
        : await supabase
            .from('wedding_bookings')
            .delete()
            .eq('wedding_id', weddingId)
            .eq('event_slug', change.event)
            .eq('category_slug', change.category));
      break;
    case 'guests':
      ({ error } = await supabase
        .from('wedding_events')
        .update({ guest_band: change.band })
        .eq('wedding_id', weddingId)
        .eq('event_slug', change.event));
      break;
  }
  if (error) throw error;
}

function updateCachedWedding(
  queryClient: QueryClient,
  userId: string,
  weddingId: string,
  change: WeddingChange,
) {
  queryClient.setQueryData<AccountWedding[]>(weddingKeys.mine(userId), (list) =>
    list?.map((w) => (w.id === weddingId ? applyChange(w, change) : w)),
  );
}

const NO_EDITS = {
  setWeddingDate: (_date: string | null) => {},
  setTraditions: (_slugs: string[]) => {},
  toggleTradition: (_slug: string, _current: string[]) => {},
  toggleEvent: (_slug: string) => {},
  addEvents: (_slugs: string[]) => {},
  toggleBooked: (_event: string, _category: string) => {},
  setEventGuests: (_event: string, _band: string | null) => {},
};

/**
 * My Wedding for the plan screen: the account's plan, with edits saved to the
 * account (shown at once and undone if saving fails). Without a wedding there
 * is nothing to edit: `wedding` is null and the screens offer to start one.
 * While the account loads, the phone's copy stands in (`loading`).
 */
export function useWeddingPlan() {
  const queryClient = useQueryClient();
  const { session, status } = useSession();
  const userId = session?.user.id ?? '';
  const phonePlan = usePlan();
  const weddings = useMyWeddings();
  const wedding = weddings.data?.[0] ?? null;

  const edit = useMutation({
    mutationFn: ({ weddingId, change }: { weddingId: string; change: WeddingChange }) =>
      saveChange(weddingId, change),
    onMutate: async ({ weddingId, change }) => {
      await queryClient.cancelQueries({ queryKey: weddingKeys.mine(userId) });
      const previous = queryClient.getQueryData<AccountWedding[]>(weddingKeys.mine(userId));
      updateCachedWedding(queryClient, userId, weddingId, change);
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(weddingKeys.mine(userId), context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: weddingKeys.mine(userId) }),
  });

  if (!wedding) {
    const loading = status === 'loading' || (status === 'signedIn' && weddings.isPending);
    return {
      plan: loading && phonePlan.syncedWeddingId ? phonePlan : EMPTY_PLAN,
      wedding: null,
      loading,
      canEdit: false,
      saveFailed: false,
      ...NO_EDITS,
    };
  }

  const change = (c: WeddingChange) => edit.mutate({ weddingId: wedding.id, change: c });
  return {
    plan: toPlan(wedding),
    wedding,
    loading: false,
    canEdit: wedding.role !== 'viewer',
    saveFailed: edit.isError,
    setWeddingDate: (date: string | null) => change({ kind: 'date', date }),
    setTraditions: (slugs: string[]) => change({ kind: 'traditions', slugs }),
    /** `current` is what the screen shows (see pickTradition). */
    toggleTradition: (slug: string, current: string[]) => {
      const slugs = pickTradition(wedding.traditions, current, slug);
      if (slugs) change({ kind: 'traditions', slugs });
    },
    toggleEvent: (slug: string) =>
      change({ kind: 'event', slug, on: !wedding.events.includes(slug) }),
    addEvents: (slugs: string[]) => {
      const fresh = slugs.filter((slug) => !wedding.events.includes(slug));
      if (fresh.length > 0) change({ kind: 'addEvents', slugs: fresh });
    },
    toggleBooked: (event: string, category: string) =>
      change({
        kind: 'booked',
        event,
        category,
        on: !(wedding.booked[event] ?? []).includes(category),
      }),
    setEventGuests: (event: string, band: string | null) => change({ kind: 'guests', event, band }),
  };
}

/**
 * Save the phone's plan to the account (or open the wedding they already
 * have), so it can be shared. Returns the wedding id.
 */
export function useStartWedding() {
  const queryClient = useQueryClient();
  return useMutation({
    /** `planningFor` is who it's for (weddings.planning_for), from the first questions. */
    mutationFn: async (plan: WeddingPlan & { planningFor?: string | null }): Promise<string> => {
      const { data: auth } = await supabase.auth.getSession();
      const userId = auth.session?.user.id;
      if (!userId) throw new Error('not_signed_in');
      const existing = await fetchMyWeddings(userId);
      if (existing[0]) return existing[0].id;
      const { data, error } = await supabase.rpc('create_wedding', {
        p_wedding_date: plan.weddingDate ?? undefined,
        p_planning_for: plan.planningFor ?? undefined,
        p_events: plan.events,
        p_booked: plan.booked,
      });
      if (error) throw error;
      // The traditions and guest counts per event come across too (best effort)
      if (plan.traditions.length > 0) {
        await supabase.from('weddings').update({ traditions: plan.traditions }).eq('id', data);
      }
      await Promise.all(
        Object.entries(plan.guests ?? {})
          .filter(([event]) => plan.events.includes(event))
          .map(([event, band]) =>
            supabase
              .from('wedding_events')
              .update({ guest_band: band })
              .eq('wedding_id', data)
              .eq('event_slug', event),
          ),
      );
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: weddingKeys.all }),
  });
}

// Members ------------------------------------------------------------------------------

export type WeddingMember = {
  userId: string;
  role: WeddingRole;
  name: string | null;
  isMe: boolean;
};

/** Everyone planning a wedding, owner first, with the names from their profiles. */
export function useWeddingMembers(weddingId: string | null) {
  return useQuery({
    queryKey: weddingKeys.members(weddingId ?? ''),
    queryFn: async (): Promise<WeddingMember[]> => {
      const { data, error } = await supabase.rpc('wedding_members_list', {
        p_wedding_id: weddingId ?? '',
      });
      if (error) throw error;
      return data
        .filter((m) => isRole(m.role))
        .map((m) => ({
          userId: m.user_id,
          role: m.role as WeddingRole,
          name: m.name,
          isMe: m.is_me,
        }));
    },
    enabled: !!weddingId,
  });
}

/** Leave a wedding (your own id) or, as the owner, remove someone. */
export function useRemoveMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ weddingId, userId }: { weddingId: string; userId: string }) => {
      const { error } = await supabase.rpc('remove_wedding_member', {
        p_wedding_id: weddingId,
        p_user_id: userId,
      });
      if (error) throw error;
    },
    onSuccess: (_data, { weddingId }) => {
      void queryClient.invalidateQueries({ queryKey: weddingKeys.members(weddingId) });
      void queryClient.invalidateQueries({ queryKey: weddingKeys.all });
    },
  });
}

// Invites ------------------------------------------------------------------------------

/**
 * The link a family member shares: the website's /join page once there's a
 * domain (it opens without the app), until then a link into the app (in Expo
 * Go, the development server's address).
 */
export function inviteLink(token: string): string {
  return SITE_URL_IS_PLACEHOLDER ? Linking.createURL(`/join/${token}`) : siteLink(`/join/${token}`);
}

/** Make a join link for relatives: role planner (can help) or viewer (can look). */
export function useCreateInvite() {
  return useMutation({
    mutationFn: async ({
      weddingId,
      role,
    }: {
      weddingId: string;
      role: 'planner' | 'viewer';
    }): Promise<string> => {
      const { data, error } = await supabase.rpc('create_wedding_invite', {
        p_wedding_id: weddingId,
        p_role: role,
      });
      if (error) throw error;
      return inviteLink(data);
    },
  });
}

type Translate = (key: string, options?: Record<string, string | number>) => string;

/**
 * Open the share sheet with the invite (usually to the family WhatsApp group).
 * Browsers without a share sheet copy it instead. Returns 'copied' then.
 */
export async function shareInvite(
  link: string,
  t: Translate,
): Promise<'shared' | 'copied' | 'none'> {
  const message = t('planTogether.inviteMessage', { link });
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && !navigator.share) {
    try {
      await navigator.clipboard.writeText(message);
      return 'copied';
    } catch {
      return 'none';
    }
  }
  try {
    await Share.share({ message });
    return 'shared';
  } catch {
    return 'none';
  }
}

export type InviteStatus = 'valid' | 'expired' | 'used_up' | 'revoked' | 'not_found';

export type InvitePreview = {
  status: InviteStatus;
  title: string | null;
  weddingDate: string | null;
  inviterName: string | null;
  role: 'planner' | 'viewer' | null;
};

/** What a relative sees before joining. Works logged out. */
export function useInvitePreview(token: string) {
  return useQuery({
    queryKey: weddingKeys.invite(token),
    queryFn: async (): Promise<InvitePreview> => {
      const { data, error } = await supabase.rpc('wedding_invite_preview', { p_token: token });
      if (error) throw error;
      const row = data[0];
      const status = (row?.status ?? 'not_found') as InviteStatus;
      return {
        status,
        title: row?.title ?? null,
        weddingDate: row?.wedding_date ?? null,
        inviterName: row?.inviter_name ?? null,
        role: row?.role === 'planner' || row?.role === 'viewer' ? row.role : null,
      };
    },
    enabled: token.length > 0,
  });
}

export type JoinError =
  'revoked' | 'expired' | 'used_up' | 'not_found' | 'full' | 'too_many' | 'failed';

/** Which message to show when joining fails (the database's error names, as kinds). */
export function joinErrorKind(error: unknown): JoinError {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (message.includes('invite_revoked')) return 'revoked';
  if (message.includes('invite_expired')) return 'expired';
  if (message.includes('invite_used_up')) return 'used_up';
  if (message.includes('invite_not_found')) return 'not_found';
  if (message.includes('wedding_full')) return 'full';
  if (message.includes('too_many_weddings')) return 'too_many';
  return 'failed';
}

/** Join a wedding with an invite token; returns the wedding id. */
export function useAcceptInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (token: string): Promise<string> => {
      const { data, error } = await supabase.rpc('accept_wedding_invite', { p_token: token });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: weddingKeys.all }),
  });
}
