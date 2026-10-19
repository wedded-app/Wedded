import {
  batches,
  firstName,
  linkFor,
  namesPreview,
  openComposer,
  sameList,
  type GuestSend,
  type Recipient,
} from './send-to-guests';

const mockSms = jest.fn(async (..._args: unknown[]) => ({ result: 'sent' }));
jest.mock('expo-sms', () => ({
  sendSMSAsync: (...args: unknown[]) => mockSms(...args),
  isAvailableAsync: async () => true,
}));

const mockMail = jest.fn(async (..._args: unknown[]) => ({ status: 'saved' }));
jest.mock('expo-mail-composer', () => ({
  composeAsync: (...args: unknown[]) => mockMail(...args),
  isAvailableAsync: async () => true,
  MailComposerStatus: {
    SENT: 'sent',
    SAVED: 'saved',
    CANCELLED: 'cancelled',
    UNDETERMINED: 'undetermined',
  },
}));

const guest = (
  id: string,
  name: string,
  phone: string | null,
  email: string | null,
): Recipient => ({
  id,
  name,
  phone,
  email,
  rsvpUrl: `https://wedded.app/rsvp/${id}`,
});

const priya = guest('1', 'Priya Sandhu', '+15305550101', 'priya@example.com');
const aman = guest('2', 'Aman Gill', '+15305550102', null);
const raj = guest('3', 'Raj', null, 'raj@example.com');
const nina = guest('4', 'Nina Bains', '+15305550104', null);

describe('sending to guests', () => {
  it('finds a list with or without the word list', () => {
    expect(sameList('Mehndi list', 'mehndi')).toBe(true);
    expect(sameList('Mehndi List', 'Mehndi list ')).toBe(true);
    expect(sameList("Mom's side", "mom's side")).toBe(true);
    expect(sameList('Mehndi list', 'Reception')).toBe(false);
  });

  it('texts each person on their own, or everyone at once, leaving out who it cannot reach', () => {
    const all = [priya, aman, raj, nina];
    expect(batches('each', all)).toEqual([[priya], [aman], [nina]]);
    expect(batches('group', all)).toEqual([[priya, aman, nina]]);
    expect(batches('email', all)).toEqual([[priya, raj]]);
    expect(batches('email', [aman])).toEqual([]);
  });

  it('shows the first few first names and how many more', () => {
    expect(firstName('  Priya Sandhu ')).toBe('Priya');
    expect(namesPreview([priya, aman, raj, nina])).toEqual({
      names: ['Priya', 'Aman', 'Raj'],
      more: 1,
    });
    expect(namesPreview([priya])).toEqual({ names: ['Priya'], more: 0 });
  });

  it("ends each person's own text with their RSVP link, and every vault message with its link", () => {
    const cards: GuestSend = { to: { list: 'Mehndi' }, events: ['jaago'], channel: 'each' };
    expect(linkFor(cards, [priya], null)).toEqual({
      line: 'rsvpLine',
      url: 'https://wedded.app/rsvp/1',
    });
    expect(linkFor({ ...cards, channel: 'group' }, [priya, aman], null)).toBeNull();
    expect(linkFor({ ...cards, channel: 'email' }, [priya], null)).toBeNull();
    const vault: GuestSend = { ...cards, events: [], vault: true };
    expect(linkFor(vault, [priya], 'https://wedded.app/join-vault/t')).toEqual({
      line: 'vaultLine',
      url: 'https://wedded.app/join-vault/t',
    });
    expect(linkFor({ ...vault, channel: 'group' }, [priya, aman], 'https://v')).toEqual({
      line: 'vaultLine',
      url: 'https://v',
    });
  });

  it('opens Messages with the cards attached, and Mail with everyone on BCC', async () => {
    await expect(openComposer('each', [priya], 'Hi', ['file:///a.png'], 'Invite')).resolves.toBe(
      'sent',
    );
    expect(mockSms).toHaveBeenCalledWith(['+15305550101'], 'Hi', {
      attachments: [{ uri: 'file:///a.png', mimeType: 'image/png', filename: 'invitation-1.png' }],
    });

    // A draft saved in Mail hasn't gone anywhere
    await expect(openComposer('email', [priya, raj], 'Hi', [], 'Invite')).resolves.toBe(
      'cancelled',
    );
    expect(mockMail).toHaveBeenCalledWith({
      bccRecipients: ['priya@example.com', 'raj@example.com'],
      subject: 'Invite',
      body: 'Hi',
      attachments: [],
    });
  });
});
