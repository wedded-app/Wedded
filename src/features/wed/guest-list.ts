import { useMemo } from 'react';

import { rsvpLink, useGuestLists, useGuests } from '@/data/guests';
import { useMyWeddings } from '@/data/wedding';
import { useSession } from '@/features/auth/session';

import { sameList, type GuestSend, type Recipient } from './send-to-guests';

export type GuestListState =
  | { status: 'signedOut' | 'loading' | 'missing' | 'error' }
  | {
      status: 'ready';
      weddingId: string;
      /** The list's id; null for everyone invited to an event. */
      listId: string | null;
      /** The list as the family named it: "Mehndi list" (empty for an event's guests). */
      name: string;
      recipients: Recipient[];
      /** The events in the family's plan, by slug: only these can have invites. */
      events: string[];
    };

/**
 * The guests Wed was asked to send to: one of the family's lists ("Mehndi"
 * finds the "Mehndi list") or everyone invited to an event, each with their
 * own RSVP link. Their own wedding, the first of useMyWeddings like My
 * Wedding's. Nothing is loaded until someone is asked for.
 */
export function useGuestList(to: GuestSend['to'] | undefined): GuestListState {
  const { status } = useSession();
  const weddings = useMyWeddings();
  const wedding = to ? (weddings.data?.[0] ?? null) : null;
  const weddingId = wedding?.id ?? null;
  const lists = useGuestLists(weddingId);
  const guests = useGuests(weddingId);

  const failed = status === 'error' || weddings.isError || lists.isError || guests.isError;
  return useMemo((): GuestListState => {
    if (failed) return { status: 'error' };
    if (!to || status === 'loading') return { status: 'loading' };
    // Signed out, the weddings query never runs, so it stays pending
    if (status !== 'signedIn') return { status: 'signedOut' };
    if (weddings.isPending) return { status: 'loading' };
    if (!wedding) return { status: 'missing' };
    if (!lists.data || !guests.data) return { status: 'loading' };
    let list = null;
    let members;
    if ('list' in to) {
      list = lists.data.find((l) => sameList(l.name, to.list)) ?? null;
      if (!list) return { status: 'missing' };
      const ids = new Set(list.guestIds);
      members = guests.data.filter((guest) => ids.has(guest.id));
    } else {
      members = guests.data.filter((guest) => guest.invites.some((i) => i.eventSlug === to.event));
      if (members.length === 0) return { status: 'missing' };
    }
    return {
      status: 'ready',
      weddingId: wedding.id,
      listId: list?.id ?? null,
      name: list?.name ?? '',
      recipients: members.map((guest) => ({
        id: guest.id,
        name: guest.name,
        phone: guest.phone,
        email: guest.email,
        rsvpUrl: rsvpLink(guest.rsvpToken),
      })),
      events: wedding.events,
    };
  }, [failed, to, status, weddings.isPending, wedding, lists.data, guests.data]);
}
