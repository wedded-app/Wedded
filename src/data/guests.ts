/**
 * Guest list and per-event RSVP (#130): the people a family invites (a
 * person or a household, with how many the invite is for), named lists
 * ("Mehndi list", "Mom's side"), which events each guest is invited to and
 * their answer, and when invitations went out. Only the owner and editors
 * see any of it. Guests answer logged out on the RSVP page (/rsvp/{token});
 * the couple can answer for someone who called them with the same token.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { shareLink } from '@/constants/links';
import { supabase } from '@/lib/supabase';

export type Rsvp = 'pending' | 'yes' | 'no';

export type GuestInvite = {
  eventSlug: string;
  rsvp: Rsvp;
  /** How many of the party are coming: null while pending, 0 for no. */
  coming: number | null;
  answeredAt: string | null;
};

export type Guest = {
  id: string;
  name: string;
  /** E.164, like +15305550100. */
  phone: string | null;
  email: string | null;
  partySize: number;
  rsvpToken: string;
  invites: GuestInvite[];
  /** When an invitation last went out; null if never. */
  lastSentAt: string | null;
};

type GuestRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  party_size: number;
  rsvp_token: string;
  guest_invites: {
    event: { event_slug: string } | null;
    rsvp: string;
    coming: number | null;
    answered_at: string | null;
  }[];
  invite_sends: { sent_at: string }[];
};

function toRsvp(value: string | null): Rsvp {
  return value === 'yes' || value === 'no' ? value : 'pending';
}

export function toGuest(row: GuestRow): Guest {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    partySize: row.party_size,
    rsvpToken: row.rsvp_token,
    invites: row.guest_invites.flatMap((i) =>
      i.event
        ? [
            {
              eventSlug: i.event.event_slug,
              rsvp: toRsvp(i.rsvp),
              coming: i.coming,
              answeredAt: i.answered_at,
            },
          ]
        : [],
    ),
    lastSentAt: row.invite_sends.reduce<string | null>(
      (latest, s) => (latest && latest > s.sent_at ? latest : s.sent_at),
      null,
    ),
  };
}

export type GuestError =
  | 'notAllowed'
  | 'badPhone'
  | 'phoneTaken'
  | 'badEmail'
  | 'tooMany'
  | 'guestLimit'
  | 'listNameTaken'
  | 'listLimit'
  | 'eventNotInPlan'
  | 'notFound'
  | 'notInvited'
  | 'invalidCount'
  | 'rsvpLimit'
  | 'sendLimit'
  | 'findLimit'
  | 'failed';

const ERRORS: [string, GuestError][] = [
  ['not_allowed', 'notAllowed'],
  ['wedding_guests_phone_check', 'badPhone'],
  ['wedding_guests_one_per_phone', 'phoneTaken'],
  ['wedding_guests_email_check', 'badEmail'],
  ['too_many_guests', 'tooMany'],
  ['guest_limit', 'guestLimit'],
  ['list_name_taken', 'listNameTaken'],
  ['list_limit', 'listLimit'],
  ['event_not_in_plan', 'eventNotInPlan'],
  ['rsvp_not_found', 'notFound'],
  ['not_invited', 'notInvited'],
  ['invalid_count', 'invalidCount'],
  ['rsvp_limit', 'rsvpLimit'],
  ['send_limit', 'sendLimit'],
  ['find_limit', 'findLimit'],
];

/** Which message to show when a guest list call fails (the database's error names). */
export function guestErrorKind(error: unknown): GuestError {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return ERRORS.find(([name]) => message.includes(name))?.[1] ?? 'failed';
}

export const guestKeys = {
  all: (weddingId: string) => ['guests', weddingId] as const,
  list: (weddingId: string) => ['guests', weddingId, 'list'] as const,
  lists: (weddingId: string) => ['guests', weddingId, 'lists'] as const,
  summary: (weddingId: string) => ['guests', weddingId, 'summary'] as const,
  weddingLink: (weddingId: string) => ['guests', weddingId, 'weddingLink'] as const,
  rsvp: (token: string) => ['rsvp', token] as const,
};

// Guests -------------------------------------------------------------------------------

/** Every guest of a wedding (at most 1,000), by name, with their invites and last send. */
export function useGuests(weddingId: string | null) {
  return useQuery({
    queryKey: guestKeys.list(weddingId ?? ''),
    queryFn: async (): Promise<Guest[]> => {
      const { data, error } = await supabase
        .from('wedding_guests')
        .select(
          'id, name, phone, email, party_size, rsvp_token, guest_invites(rsvp, coming, answered_at, event:wedding_events(event_slug)), invite_sends(sent_at)',
        )
        .eq('wedding_id', weddingId ?? '')
        .order('name')
        .limit(1000);
      if (error) throw error;
      return (data as GuestRow[]).map(toGuest);
    },
    enabled: !!weddingId,
  });
}

export type GuestDraft = {
  name: string;
  /** E.164; contacts are normalized before they get here. */
  phone?: string | null;
  email?: string | null;
  partySize?: number;
};

/**
 * Add up to 500 guests at once. A phone already on the list keeps its guest.
 * Returns the ids of the guests given, new or already there.
 */
export function useAddGuests() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      weddingId,
      guests,
    }: {
      weddingId: string;
      guests: GuestDraft[];
    }): Promise<string[]> => {
      const { data, error } = await supabase.rpc('add_guests', {
        p_wedding_id: weddingId,
        p_guests: guests.map((g) => ({
          name: g.name,
          phone: g.phone || null,
          email: g.email || null,
          party_size: g.partySize ?? 1,
        })),
      });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    onSuccess: (_ids, { weddingId }) =>
      queryClient.invalidateQueries({ queryKey: guestKeys.all(weddingId) }),
  });
}

/** Change a guest: every field is saved as given (empty phone or email clears it). */
export function useUpdateGuest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      name,
      phone,
      email,
      partySize,
    }: GuestDraft & { weddingId: string; id: string }) => {
      const { error } = await supabase.rpc('update_guest', {
        p_guest_id: id,
        p_name: name,
        p_phone: phone ?? undefined,
        p_email: email ?? undefined,
        p_party_size: partySize ?? 1,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, { weddingId }) =>
      queryClient.invalidateQueries({ queryKey: guestKeys.all(weddingId) }),
  });
}

/** Remove a guest, with their list places, invites and sends. */
export function useRemoveGuest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { weddingId: string; id: string }) => {
      const { error } = await supabase.rpc('remove_guest', { p_guest_id: id });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, { weddingId }) =>
      queryClient.invalidateQueries({ queryKey: guestKeys.all(weddingId) }),
  });
}

// Lists --------------------------------------------------------------------------------

export type GuestList = { id: string; name: string; guestIds: string[] };

export function useGuestLists(weddingId: string | null) {
  return useQuery({
    queryKey: guestKeys.lists(weddingId ?? ''),
    queryFn: async (): Promise<GuestList[]> => {
      const { data, error } = await supabase
        .from('guest_lists')
        .select('id, name, guest_list_members(guest_id)')
        .eq('wedding_id', weddingId ?? '')
        .order('name');
      if (error) throw error;
      return data.map((l) => ({
        id: l.id,
        name: l.name,
        guestIds: l.guest_list_members.map((m) => m.guest_id),
      }));
    },
    enabled: !!weddingId,
  });
}

/**
 * Make a list (no id) or rename one, and when guestIds is given, make it hold
 * exactly those guests. Returns the list's id.
 */
export function useSaveGuestList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      weddingId,
      id,
      name,
      guestIds,
    }: {
      weddingId: string;
      id?: string;
      name: string;
      guestIds?: string[];
    }): Promise<string> => {
      let listId = id;
      if (listId) {
        const { error } = await supabase.rpc('rename_guest_list', {
          p_list_id: listId,
          p_name: name,
        });
        if (error) throw new Error(error.message);
      } else {
        const { data, error } = await supabase.rpc('create_guest_list', {
          p_wedding_id: weddingId,
          p_name: name,
        });
        if (error) throw new Error(error.message);
        listId = data;
      }
      if (guestIds) {
        const { error } = await supabase.rpc('set_guest_list_members', {
          p_list_id: listId,
          p_guest_ids: guestIds,
        });
        if (error) throw new Error(error.message);
      }
      return listId;
    },
    // Settled, not success: a new list may exist even if setting its members failed
    onSettled: (_id, _error, { weddingId }) =>
      queryClient.invalidateQueries({ queryKey: guestKeys.lists(weddingId) }),
  });
}

/** Delete a list. Its guests stay, and so do their invites. */
export function useDeleteGuestList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { weddingId: string; id: string }) => {
      const { error } = await supabase.rpc('delete_guest_list', { p_list_id: id });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, { weddingId }) =>
      queryClient.invalidateQueries({ queryKey: guestKeys.lists(weddingId) }),
  });
}

// Invites and RSVPs ---------------------------------------------------------------------

/** Invite guests, a whole list, or both to an event. Returns how many were newly invited. */
export function useInviteToEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      weddingId,
      eventSlug,
      guestIds,
      listId,
    }: {
      weddingId: string;
      eventSlug: string;
      guestIds?: string[];
      listId?: string;
    }): Promise<number> => {
      const { data, error } = await supabase.rpc('invite_to_event', {
        p_wedding_id: weddingId,
        p_event_slug: eventSlug,
        p_guest_ids: guestIds,
        p_list_id: listId,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_added, { weddingId }) =>
      queryClient.invalidateQueries({ queryKey: guestKeys.all(weddingId) }),
  });
}

/** Take guests off one event (ticked by mistake). Their answer for it goes too. Returns how many. */
export function useUninviteFromEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      weddingId,
      eventSlug,
      guestIds,
    }: {
      weddingId: string;
      eventSlug: string;
      guestIds: string[];
    }): Promise<number> => {
      const { data, error } = await supabase.rpc('uninvite_from_event', {
        p_wedding_id: weddingId,
        p_event_slug: eventSlug,
        p_guest_ids: guestIds,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_removed, { weddingId }) =>
      queryClient.invalidateQueries({ queryKey: guestKeys.all(weddingId) }),
  });
}

/**
 * The link a guest gets: the website's /rsvp page once there's a domain (it
 * opens without the app), until then a link into the app, like inviteLink().
 */
export function rsvpLink(token: string): string {
  return shareLink(`/rsvp/${token}`);
}

/**
 * The wedding's own RSVP link (#337), the same for everyone: it goes in group
 * texts and WhatsApp groups, and a guest types their number to find their
 * family's RSVP. Null while the couple has turned it off.
 */
export function weddingRsvpLink(token: string | null): string | null {
  return token ? shareLink(`/rsvp/w/${token}`) : null;
}

/** The wedding link's token; null while it's off. Members only. */
export function useWeddingRsvpToken(weddingId: string | null) {
  return useQuery({
    queryKey: guestKeys.weddingLink(weddingId ?? ''),
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from('weddings')
        .select('rsvp_token')
        .eq('id', weddingId ?? '')
        .maybeSingle();
      if (error) throw error;
      return data?.rsvp_token ?? null;
    },
    enabled: !!weddingId,
  });
}

/** Turn the wedding link on (keeps the current one), off, or replace it with a new one. */
export function useSetWeddingRsvpLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      weddingId,
      action,
    }: {
      weddingId: string;
      action: 'on' | 'off' | 'new';
    }) => {
      const { data, error } = await supabase.rpc('set_wedding_rsvp_link', {
        p_wedding_id: weddingId,
        p_action: action,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_token, { weddingId }) =>
      queryClient.invalidateQueries({ queryKey: guestKeys.weddingLink(weddingId) }),
  });
}

/**
 * On the wedding link, logged out: the family's own RSVP token for the phone
 * number or email they typed, or null when it isn't on the list. Throws
 * notFound for a dead link and findLimit after 20 misses in a day.
 */
export async function findInvitation(
  weddingToken: string,
  contact: string,
): Promise<string | null> {
  const { data, error } = await supabase.rpc('rsvp_find', {
    p_token: weddingToken,
    p_contact: contact,
  });
  if (error) throw new Error(error.message);
  return data;
}

export type RsvpEvent = {
  eventSlug: string;
  eventDate: string | null;
  /** Local times, "18:00:00". */
  startsAt: string | null;
  endsAt: string | null;
  /** The listed hall or gurdwara's name, or what the family typed. */
  place: string | null;
  rsvp: Rsvp;
  coming: number | null;
  answeredAt: string | null;
};

export type RsvpPreview = {
  /** The couple, e.g. "Jaspreet & Amrit". */
  title: string | null;
  weddingDate: string | null;
  guestName: string;
  partySize: number;
  /** Only the events this guest is invited to, in date order; empty if none yet. */
  events: RsvpEvent[];
};

type PreviewRow = {
  title: string | null;
  wedding_date: string | null;
  guest_name: string;
  party_size: number;
  event_slug: string | null;
  event_date: string | null;
  starts_at: string | null;
  ends_at: string | null;
  place: string | null;
  rsvp: string | null;
  coming: number | null;
  answered_at: string | null;
};

/** The RSVP page's rows as one preview; null for an unknown token. */
export function toRsvpPreview(rows: PreviewRow[]): RsvpPreview | null {
  const first = rows[0];
  if (!first) return null;
  return {
    title: first.title,
    weddingDate: first.wedding_date,
    guestName: first.guest_name,
    partySize: first.party_size,
    events: rows.flatMap((r) =>
      r.event_slug
        ? [
            {
              eventSlug: r.event_slug,
              eventDate: r.event_date,
              startsAt: r.starts_at,
              endsAt: r.ends_at,
              place: r.place,
              rsvp: toRsvp(r.rsvp),
              coming: r.coming,
              answeredAt: r.answered_at,
            },
          ]
        : [],
    ),
  };
}

/** What a guest sees on the RSVP page. Works logged out; null for an unknown token. */
export function useRsvpPreview(token: string) {
  return useQuery({
    queryKey: guestKeys.rsvp(token),
    queryFn: async (): Promise<RsvpPreview | null> => {
      const { data, error } = await supabase.rpc('rsvp_preview', { p_token: token });
      if (error) throw error;
      return toRsvpPreview(data as PreviewRow[]);
    },
    enabled: !!token,
  });
}

/** Answer for one event: yes with how many are coming (the whole party if left out), or no. */
export function useRsvp(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      eventSlug,
      answer,
      coming,
    }: {
      eventSlug: string;
      answer: 'yes' | 'no';
      coming?: number;
    }) => {
      const { error } = await supabase.rpc('rsvp', {
        p_token: token,
        p_event_slug: eventSlug,
        p_answer: answer,
        p_coming: coming,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: guestKeys.rsvp(token) });
      // The couple may have answered for a guest
      void queryClient.invalidateQueries({ queryKey: ['guests'] });
    },
  });
}

export type EventGuestSummary = {
  eventSlug: string;
  /** Guests (households) invited, and how many said yes, no or haven't answered. */
  invited: number;
  yes: number;
  no: number;
  pending: number;
  /** People: everyone in the invited parties, and those coming. */
  peopleInvited: number;
  coming: number;
};

/** Per event in the plan, in date order: who's invited and who's coming. */
export function useGuestSummary(weddingId: string | null) {
  return useQuery({
    queryKey: guestKeys.summary(weddingId ?? ''),
    queryFn: async (): Promise<EventGuestSummary[]> => {
      const { data, error } = await supabase.rpc('guest_summary', {
        p_wedding_id: weddingId ?? '',
      });
      if (error) throw error;
      return data.map((s) => ({
        eventSlug: s.event_slug,
        invited: s.invited,
        yes: s.yes,
        no: s.no,
        pending: s.pending,
        peopleInvited: s.people_invited,
        coming: s.coming,
      }));
    },
    enabled: !!weddingId,
  });
}

/** Note that invitations went out from the phone (up to 500 guests at a time). Returns how many. */
export function useLogInviteSends() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      weddingId,
      guestIds,
      channel,
    }: {
      weddingId: string;
      guestIds: string[];
      channel: 'text' | 'email';
    }): Promise<number> => {
      const { data, error } = await supabase.rpc('log_invite_sends', {
        p_wedding_id: weddingId,
        p_guest_ids: guestIds,
        p_channel: channel,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_count, { weddingId }) =>
      queryClient.invalidateQueries({ queryKey: guestKeys.list(weddingId) }),
  });
}
