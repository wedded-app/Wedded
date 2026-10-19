import { useMemo } from 'react';

import { rsvpLink, useGuestLists, useGuests } from '@/data/guests';
import { useMyWeddings } from '@/data/wedding';
import { useSession } from '@/features/auth/session';

import { sameList, type Recipient } from './send-to-guests';

export type GuestListState =
  | { status: 'signedOut' | 'loading' | 'missing' | 'error' }
  | {
      status: 'ready';
      weddingId: string;
      listId: string;
      /** As the family named it: "Mehndi list". */
      name: string;
      recipients: Recipient[];
      /** The events in the family's plan, by slug: only these can have invites. */
      events: string[];
    };

/**
 * The family's guest list that Wed was asked about ("Mehndi" finds the
 * "Mehndi list"), each guest with their own RSVP link. Their own wedding,
 * the first of useMyWeddings like My Wedding's. Nothing is loaded until a
 * list is asked for.
 */
export function useGuestList(asked: string | undefined): GuestListState {
  const { status } = useSession();
  const weddings = useMyWeddings();
  const wedding = asked ? (weddings.data?.[0] ?? null) : null;
  const weddingId = wedding?.id ?? '';
  const lists = useGuestLists(weddingId);
  const guests = useGuests(weddingId);

  const failed = status === 'error' || weddings.isError || lists.isError || guests.isError;
  return useMemo((): GuestListState => {
    if (failed) return { status: 'error' };
    if (!asked || status === 'loading') return { status: 'loading' };
    // Signed out, the weddings query never runs, so it stays pending
    if (status !== 'signedIn') return { status: 'signedOut' };
    if (weddings.isPending) return { status: 'loading' };
    if (!wedding) return { status: 'missing' };
    if (!lists.data || !guests.data) return { status: 'loading' };
    const list = lists.data.find((l) => sameList(l.name, asked));
    if (!list) return { status: 'missing' };
    const members = new Set(list.guestIds);
    return {
      status: 'ready',
      weddingId: wedding.id,
      listId: list.id,
      name: list.name,
      recipients: guests.data
        .filter((guest) => members.has(guest.id))
        .map((guest) => ({
          id: guest.id,
          name: guest.name,
          phone: guest.phone,
          email: guest.email,
          rsvpUrl: rsvpLink(guest.rsvpToken),
        })),
      events: wedding.events,
    };
  }, [failed, asked, status, weddings.isPending, wedding, lists.data, guests.data]);
}
