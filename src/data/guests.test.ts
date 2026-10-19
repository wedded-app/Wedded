import { guestErrorKind, toGuest, toRsvpPreview } from './guests';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const wedding = {
  title: 'Asha & Ravi',
  wedding_date: '2027-04-24',
  guest_name: 'Sandhu family',
  party_size: 4,
};
const noEvent = {
  event_slug: null,
  event_date: null,
  starts_at: null,
  ends_at: null,
  place: null,
  rsvp: null,
  coming: null,
  answered_at: null,
};

describe('guests', () => {
  it('reads a guest with their answers and the last time an invitation went out', () => {
    const guest = toGuest({
      id: 'g1',
      name: 'Sandhu family',
      phone: '+15305550201',
      email: null,
      party_size: 4,
      rsvp_token: 'abc',
      guest_invites: [
        {
          event: { event_slug: 'mehndi' },
          rsvp: 'yes',
          coming: 3,
          answered_at: '2026-10-19T10:00:00Z',
        },
        { event: { event_slug: 'reception' }, rsvp: 'pending', coming: null, answered_at: null },
      ],
      invite_sends: [
        { sent_at: '2026-10-12T09:00:00Z' },
        { sent_at: '2026-10-19T09:00:00Z' },
        { sent_at: '2026-10-15T09:00:00Z' },
      ],
    });
    expect(guest.invites.map((i) => [i.eventSlug, i.rsvp, i.coming])).toEqual([
      ['mehndi', 'yes', 3],
      ['reception', 'pending', null],
    ]);
    expect(guest.lastSentAt).toBe('2026-10-19T09:00:00Z');
    expect(toGuest({ ...guestRow(), invite_sends: [] }).lastSentAt).toBeNull();
  });

  it('turns the RSVP page rows into one preview', () => {
    expect(toRsvpPreview([])).toBeNull();
    expect(toRsvpPreview([{ ...wedding, ...noEvent }])?.events).toEqual([]);
    const preview = toRsvpPreview([
      {
        ...wedding,
        ...noEvent,
        event_slug: 'mehndi',
        event_date: '2027-04-22',
        starts_at: '18:00:00',
        place: 'Gurdwara Sahib',
        rsvp: 'no',
        coming: 0,
      },
      { ...wedding, ...noEvent, event_slug: 'reception', rsvp: 'pending' },
    ]);
    expect(preview?.guestName).toBe('Sandhu family');
    expect(preview?.events.map((e) => [e.eventSlug, e.rsvp, e.place])).toEqual([
      ['mehndi', 'no', 'Gurdwara Sahib'],
      ['reception', 'pending', null],
    ]);
  });

  it('names the error to show', () => {
    expect(guestErrorKind(new Error('list_name_taken'))).toBe('listNameTaken');
    expect(
      guestErrorKind(
        new Error('duplicate key value violates unique constraint "wedding_guests_one_per_phone"'),
      ),
    ).toBe('phoneTaken');
    expect(
      guestErrorKind(new Error('new row violates check constraint "wedding_guests_phone_check"')),
    ).toBe('badPhone');
    expect(guestErrorKind(new Error('rsvp_limit'))).toBe('rsvpLimit');
    expect(guestErrorKind(new Error('network down'))).toBe('failed');
  });
});

function guestRow() {
  return {
    id: 'g2',
    name: 'Preet',
    phone: null,
    email: 'preet@example.com',
    party_size: 1,
    rsvp_token: 'def',
    guest_invites: [],
    invite_sends: [],
  };
}
