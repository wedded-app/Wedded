import type { GroupMessage, GroupThread } from '@/data/group-chat';

import { groupPreview, senderKey, senderName, wedState } from './group-format';

const t = (key: string, options?: Record<string, string | number>) =>
  options ? `${key} ${JSON.stringify(options)}` : key;

const message = (change: Partial<GroupMessage>): GroupMessage => ({
  id: 'm1',
  thread_id: 't1',
  sender_user_id: 'asha',
  sender_role: 'member',
  kind: 'text',
  body: 'Hi',
  data: {},
  reply_to: null,
  wed_ask: null,
  pushed_at: null,
  created_at: '2026-10-16T12:00:00Z',
  ...change,
});

describe('senderKey', () => {
  it('groups a person, Wed, and never a joined line', () => {
    expect(senderKey(message({}))).toBe('asha');
    expect(senderKey(message({ sender_role: 'wed', sender_user_id: null }))).toBe('wed');
    expect(senderKey(message({ sender_role: 'system', kind: 'joined' }))).toBe('system:m1');
  });
});

describe('senderName', () => {
  it('names people, Wed, and someone who left', () => {
    const names = new Map([['asha', 'Asha Kaur']]);
    expect(senderName(message({}), names, t)).toBe('Asha Kaur');
    expect(senderName(message({ sender_role: 'wed', sender_user_id: null }), names, t)).toBe(
      'groupChat.wed',
    );
    expect(senderName(message({ sender_user_id: 'gone' }), names, t)).toBe(
      'groupChat.formerMember',
    );
  });
});

describe('groupPreview', () => {
  const thread: GroupThread = {
    id: 't1',
    weddingId: 'w1',
    name: 'Family',
    memberCount: 3,
    canManage: true,
    lastMessageAt: '2026-10-16T12:00:00Z',
    lastKind: 'text',
    lastBody: 'See you at 6',
    lastSenderRole: 'member',
    lastSenderName: 'Asha Kaur',
    lastSenderIsMe: false,
    unreadCount: 0,
  };
  it('says who wrote what', () => {
    expect(groupPreview(thread, t)).toBe(
      'groupChat.preview.text {"name":"Asha Kaur","text":"See you at 6"}',
    );
    expect(groupPreview({ ...thread, lastSenderRole: 'wed', lastSenderName: null }, t)).toContain(
      '"name":"groupChat.wed"',
    );
    expect(groupPreview({ ...thread, lastKind: 'joined' }, t)).toBe(
      'groupChat.preview.joined {"name":"Asha Kaur"}',
    );
    expect(groupPreview({ ...thread, lastKind: 'photo', lastSenderIsMe: true }, t)).toBe(
      'groupChat.preview.photo {"name":"groupChat.you"}',
    );
    expect(groupPreview({ ...thread, lastKind: null }, t)).toBe('groupChat.noMessages');
  });
});

describe('wedState', () => {
  it('follows my newest question to Wed', () => {
    expect(wedState([message({ wed_ask: 'working' })], 'asha')).toBe('thinking');
    expect(wedState([message({ wed_ask: 'failed' })], 'asha')).toBe('failed');
    expect(wedState([message({ wed_ask: 'answered' })], 'asha')).toBeNull();
    expect(wedState([message({ wed_ask: 'waiting' })], 'dev')).toBeNull();
  });
});
