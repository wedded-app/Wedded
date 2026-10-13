import { messagePayload, sendErrorKind, toConversation, toMessage } from './chat';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn/${path}` } }),
      }),
    },
  },
}));
jest.mock('@/features/auth/session', () => ({ useSession: () => ({ session: null }) }));

const row = {
  id: 'm1',
  conversation_id: 'c1',
  sender_user_id: 'u1',
  sender_role: 'family',
  kind: 'text',
  body: 'Is June 12 open?',
  data: {},
  created_at: '2026-10-01T10:00:00.000Z',
};

describe('toMessage', () => {
  it('shows "Seen" on my messages once the other side read past them', () => {
    expect(toMessage(row, 'family', '2026-10-01T10:05:00.000Z').readAt).toBe(
      '2026-10-01T10:05:00.000Z',
    );
    expect(toMessage(row, 'family', '2026-10-01T09:00:00.000Z').readAt).toBeNull();
    // Not on the other side's messages
    expect(toMessage(row, 'vendor', '2026-10-01T10:05:00.000Z').readAt).toBeNull();
  });

  it('reads quotes, menus, photos and the booking details', () => {
    const quote = toMessage(
      { ...row, kind: 'quote', sender_role: 'vendor', data: { amount: 16500, unit: 'event' } },
      'family',
      null,
    );
    expect(quote.quote).toEqual({ amount: 16500, unit: 'event' });
    expect(toMessage({ ...row, kind: 'menu', data: { menuId: 'menu-1' } }, null, null).menuId).toBe(
      'menu-1',
    );
    expect(
      toMessage({ ...row, kind: 'photo', data: { path: 'c1/a.jpg' } }, null, null).photoPath,
    ).toBe('c1/a.jpg');
    const booking = toMessage(
      { ...row, kind: 'booking', data: { eventSlugs: ['reception'], guestBand: '250_500' } },
      null,
      null,
    ).booking;
    expect(booking?.eventSlugs).toEqual(['reception']);
    expect(booking?.guestBand).toBe('250_500');
  });
});

describe('replies', () => {
  it('reads which message a reply quotes, and none when it is not a reply', () => {
    expect(toMessage({ ...row, reply_to: 'm-1' }, null, null).replyTo).toBe('m-1');
    expect(toMessage(row, null, null).replyTo).toBeNull();
    expect(toMessage({ ...row, reply_to: null }, null, null).replyTo).toBeNull();
  });
});

describe('toConversation', () => {
  it('turns an inbox row into the shape the screens use', () => {
    const convo = toConversation({
      id: 'c1',
      side: 'vendor',
      vendor_id: 'v1',
      vendor_slug: 'royal-orchard',
      vendor_name: 'Royal Orchard',
      vendor_name_pa: null,
      vendor_cover_path: 'v1/p1',
      family_name: 'Harjit K.',
      last_message_at: '2026-10-01T10:00:00Z',
      last_kind: 'text',
      last_body: 'Hi',
      last_sender_role: 'family',
      unread_count: 2,
      other_read_at: null,
    });
    expect(convo.side).toBe('vendor');
    expect(convo.family.firstName).toBe('Harjit K.');
    expect(convo.vendor.photoUrl).toBe('https://cdn/v1/p1/400.webp');
    expect(convo.unreadCount).toBe(2);
  });
});

describe('sending', () => {
  it('shapes each kind for send_message', () => {
    expect(messagePayload({ kind: 'text', body: 'Hi' })).toEqual({
      kind: 'text',
      body: 'Hi',
      data: {},
    });
    expect(messagePayload({ kind: 'menu', menuId: 'm1' })).toEqual({
      kind: 'menu',
      body: null,
      data: { menuId: 'm1' },
    });
  });

  it('explains failures', () => {
    expect(sendErrorKind(new Error('message_rate'))).toBe('rate');
    expect(sendErrorKind(new Error('invalid_quote'))).toBe('invalid');
    expect(sendErrorKind(new Error('offline'))).toBe('failed');
  });
});
