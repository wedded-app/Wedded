import type { Conversation } from '@/data/chat';
import type { ShortlistVendor } from '@/data/family-shortlist';
import type { FeedPost } from '@/data/feed';
import type { WeddingMember } from '@/data/wedding';
import type { WeddingSuggestion } from '@/data/wedding-suggestions';

import { familyActivity, heroPhoto, joinNames, vendorStatusRows } from './home-feed';

const chat = (
  slug: string,
  senderRole: string | null,
  updatedAt: string,
  unreadCount = 0,
): Conversation => ({
  id: `c-${slug}`,
  side: 'family',
  vendor: { id: `v-${slug}`, slug, name: { en: slug }, photoUrl: null },
  family: { firstName: 'Harjit' },
  lastMessage: senderRole ? { kind: 'text', body: 'hi', senderRole } : null,
  unreadCount,
  updatedAt,
  otherReadAt: null,
});

describe('vendorStatusRows', () => {
  it('puts new replies first, then replies, then waiting, then booked', () => {
    const rows = vendorStatusRows(
      [
        chat('dhol', 'family', '2026-10-05T10:00:00Z'),
        chat('hall', 'vendor', '2026-10-04T10:00:00Z'),
        chat('dj', 'vendor', '2026-10-03T10:00:00Z', 2),
      ],
      { 'reception/catering': { slug: 'tandoor', name: 'Saffron Tandoor' } },
    );
    expect(rows.map((r) => [r.vendor.slug, r.status])).toEqual([
      ['dj', 'newReply'],
      ['hall', 'replied'],
      ['dhol', 'waiting'],
      ['tandoor', 'booked'],
    ]);
  });

  it('shows a booked vendor once, with its chat and every event it is booked for', () => {
    const rows = vendorStatusRows([chat('hall', 'vendor', '2026-10-04T10:00:00Z', 1)], {
      'jaago/venue': { slug: 'hall', name: 'Royal Orchard' },
      'reception/venue': { slug: 'hall', name: 'Royal Orchard' },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      status: 'booked',
      conversationId: 'c-hall',
      bookedFor: ['jaago', 'reception'],
    });
  });

  it('leaves out empty chats and the vendor side of a conversation', () => {
    const vendorSide = {
      ...chat('mine', 'family', '2026-10-05T10:00:00Z'),
      side: 'vendor' as const,
    };
    expect(vendorStatusRows([chat('empty', null, '2026-10-05T10:00:00Z'), vendorSide], {})).toEqual(
      [],
    );
  });

  it('newest first within a status', () => {
    const rows = vendorStatusRows(
      [
        chat('old', 'family', '2026-10-01T10:00:00Z'),
        chat('new', 'family', '2026-10-05T10:00:00Z'),
      ],
      {},
    );
    expect(rows.map((r) => r.vendor.slug)).toEqual(['new', 'old']);
  });
});

const member = (userId: string, name: string | null, isMe = false): WeddingMember => ({
  userId,
  role: 'editor',
  name,
  isMe,
});

const suggestion = (
  id: string,
  suggestedBy: string,
  createdAt: string,
  status: WeddingSuggestion['status'] = 'open',
): WeddingSuggestion => ({
  id,
  eventSlug: 'jaago',
  categorySlug: 'dhol',
  note: null,
  status,
  suggestedBy,
  resolvedBy: null,
  resolvedAt: null,
  createdAt,
  vendor: { id: `v-${id}`, slug: `vendor-${id}`, name: { en: `Vendor ${id}` } },
});

const shortlisted = (slug: string, lovedBy: string[], published = true): ShortlistVendor => ({
  vendorId: `v-${slug}`,
  slug,
  name: { en: slug },
  city: 'Yuba City',
  published,
  eventSlugs: [],
  savedBy: [],
  counts: { love: lovedBy.length, maybe: 0, no: 0 },
  myReaction: null,
  lovedBy,
});

describe('familyActivity', () => {
  const members = [member('me', 'Simran Kaur', true), member('mom', 'Harjit Kaur')];

  it('lists open suggestions from others first, newest first, then the most loved vendors', () => {
    const items = familyActivity(
      [shortlisted('tandoor', ['Harjit']), shortlisted('hall', ['Harjit', 'Simran'])],
      [
        suggestion('a', 'mom', '2026-10-01T00:00:00Z'),
        suggestion('b', 'mom', '2026-10-03T00:00:00Z'),
        suggestion('mine', 'me', '2026-10-04T00:00:00Z'),
        suggestion('done', 'mom', '2026-10-05T00:00:00Z', 'accepted'),
      ],
      members,
      5,
    );
    expect(items.map((i) => i.key)).toEqual([
      'suggested-b',
      'suggested-a',
      'loved-v-hall',
      'loved-v-tandoor',
    ]);
    expect(items[0]).toMatchObject({ kind: 'suggested', name: 'Harjit' });
  });

  it('skips unlisted vendors and stops at the limit', () => {
    const items = familyActivity(
      [
        shortlisted('gone', ['Harjit'], false),
        shortlisted('a', ['Harjit']),
        shortlisted('b', ['Harjit']),
      ],
      [],
      members,
      1,
    );
    expect(items.map((i) => i.key)).toEqual(['loved-v-a']);
  });
});

describe('joinNames', () => {
  it('joins one, two and three names', () => {
    expect(joinNames(['Mom'], 'and')).toBe('Mom');
    expect(joinNames(['Mom', 'Bhua'], 'and')).toBe('Mom and Bhua');
    expect(joinNames(['Mom', 'Bhua', 'Simran'], 'and')).toBe('Mom, Bhua and Simran');
  });
});

const post = (slug: string, groupSlug: string, photos = 1): FeedPost => ({
  vendorId: `v-${slug}`,
  slug,
  name: { en: slug },
  caption: { en: null, pa: null },
  city: 'Yuba City',
  foundingNumber: null,
  category: { slug: 'x', name: { en: 'X' }, groupSlug },
  price: null,
  photos: Array.from({ length: photos }, (_, i) => ({
    id: `${slug}-${i}`,
    width: 1600,
    height: 1200,
    blurhash: null,
    isCover: i === 0,
    eventSlug: null,
    credit: null,
    url: { small: `${slug}-s`, medium: `${slug}-m`, large: `${slug}-l` },
  })),
});

describe('heroPhoto', () => {
  const posts = [post('dj', 'music'), post('hall', 'venues'), post('booked-dj', 'music')];

  it('prefers a booked venue, then anything booked, then any venue', () => {
    expect(heroPhoto([...posts, post('my-hall', 'venues')], ['my-hall', 'booked-dj'])?.url).toBe(
      'my-hall-l',
    );
    expect(heroPhoto(posts, ['booked-dj'])?.url).toBe('booked-dj-l');
    expect(heroPhoto(posts, [])?.url).toBe('hall-l');
  });

  it('is null without photos', () => {
    expect(heroPhoto([post('dj', 'music', 0)], [])).toBeNull();
  });
});
