import { previewConversations } from './preview-chats';
import { getWed, wed } from './wed-store';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success' },
}));
jest.mock('@/data/vendor-media', () => ({ photoUrl: (path: string) => `https://photos/${path}` }));
const chats = () => previewConversations(getWed().approvals, getWed().items);
beforeEach(() => {
  jest.useFakeTimers();
  wed.reset();
});
afterEach(() => {
  wed.reset();
  jest.useRealTimers();
});

it('shows completed tasting requests with the exact edited message, not pending or undone sends', () => {
  expect(chats()).toEqual([]);
  wed.editMessage('tasting', 'Could we visit at 2 instead?');
  wed.approve('tasting');
  expect(chats()).toEqual([]);
  wed.undo('tasting');
  jest.advanceTimersByTime(10_000);
  expect(chats()).toEqual([]);
  wed.approve('tasting');
  jest.advanceTimersByTime(10_000);
  expect(chats()).toHaveLength(1);
  expect(chats()[0].messages[0]).toMatchObject({
    text: 'Could we visit at 2 instead?',
    from: 'family',
  });
  expect(chats()[0].name).toBe('Saffron Tandoor Catering');
});

it('creates one preview per contacted vendor and includes their scripted reply', () => {
  wed.send('Find a dhol player for the Jaago');
  jest.advanceTimersByTime(12_500);
  wed.approve('ask-dhol');
  jest.advanceTimersByTime(10_000);
  expect(chats()).toHaveLength(3);
  expect(chats().every((chat) => chat.messages.length === 1)).toBe(true);
  jest.advanceTimersByTime(13_400);
  const dhol = chats().find((chat) => chat.name === 'Dhol Di Awaaz')!;
  expect(dhol.messages.map((message) => message.from)).toEqual(['family', 'vendor']);
  expect(chats()[0].id).toBe(dhol.id);
  wed.approve('book-dhol');
  jest.advanceTimersByTime(10_000);
  expect(chats()).toHaveLength(3); // marking booked only changes the family's plan
  expect(chats().find((chat) => chat.id === dhol.id)!.messages).toHaveLength(2);
  wed.reset();
  expect(chats()).toEqual([]);
});

it('groups repeated requests to the same vendor without duplicating old messages', () => {
  wed.send('Find a dhol player for the Jaago');
  jest.advanceTimersByTime(12_500);
  wed.approve('ask-dhol');
  jest.advanceTimersByTime(10_000);
  wed.send('Find a dhol player for the Jaago');
  jest.advanceTimersByTime(12_500);
  wed.approve('ask-dhol-2');
  jest.advanceTimersByTime(10_000);
  expect(chats()).toHaveLength(3);
  const chat = chats().find((chat) => chat.name === 'Pind Beat Dholis')!;
  expect(chat.messages).toHaveLength(2);
  expect(new Set(chat.messages.map((message) => message.id)).size).toBe(2);
});
