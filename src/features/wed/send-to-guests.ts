import * as MailComposer from 'expo-mail-composer';
import * as SMS from 'expo-sms';

/**
 * Sending to guests from the family's own phone: invitation cards (#129, and
 * the send part of #127) or the Memory Vault's link (#306). Nothing goes from our server: Messages or Mail opens
 * filled in, and the phone's own Send button is the final say. Texting from
 * a server needs Twilio and carrier (A2P 10DLC) registration, which waits
 * for the LLC (#149).
 */

/**
 * How it goes: each person their own text with their own RSVP link (the
 * default), one group text to everyone, or one email with everyone on BCC.
 */
export type GuestChannel = 'each' | 'group' | 'email';

export const GUEST_CHANNELS: GuestChannel[] = ['each', 'group', 'email'];

/**
 * What Wed's brain (#124) asks for, as `sendToGuests` in wed-store.ts: a
 * confirm card in the thread, and nothing more until the family taps Send.
 */
export type GuestSend = {
  /**
   * Who: a guest list as the family calls it ("Mehndi" finds the "Mehndi
   * list"), or everyone invited to one of the plan's events, by slug.
   */
  to: { list: string } | { event: string };
  /** The events whose cards go with it, by slug, in order. */
  events: string[];
  /** The Memory Vault's link instead of cards, so guests add their photos. */
  vault?: boolean;
  channel: GuestChannel;
};

/** One guest, as a send needs them. */
export type Recipient = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  /** Their own RSVP page (rsvpLink), added to "Text each person". */
  rsvpUrl: string;
};

/** What the phone says happened: Android can't tell, so it's always 'unknown' there. */
export type ComposerResult = 'sent' | 'cancelled' | 'unknown';

/** "mehndi list", "Mehndi" and "Mehndi List" are all the same list. */
export function sameList(name: string, asked: string): boolean {
  const bare = (text: string) =>
    text
      .trim()
      .toLowerCase()
      .replace(/\s+list$/, '');
  return bare(name) === bare(asked);
}

/** The guests a channel can reach: those with a phone for texts, an email for email. */
export function reachable(channel: GuestChannel, recipients: Recipient[]): Recipient[] {
  return recipients.filter((r) => (channel === 'email' ? r.email : r.phone));
}

/** One composer each: a person at a time for "Text each person", else everyone at once. */
export function batches(channel: GuestChannel, recipients: Recipient[]): Recipient[][] {
  const to = reachable(channel, recipients);
  if (to.length === 0) return [];
  return channel === 'each' ? to.map((r) => [r]) : [to];
}

/** "Priya" from "Priya Sandhu". shortcut: the first word, so "The Gill family" is "The"; fine for a list preview. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** The names to show, and how many more there are: "Priya, Aman, Raj" and 37. */
export function namesPreview(recipients: Recipient[], show = 3) {
  return {
    names: recipients.slice(0, show).map((r) => firstName(r.name)),
    more: Math.max(0, recipients.length - show),
  };
}

/**
 * The link a batch ends with: the vault's for everyone, each person's own RSVP
 * link when texted one by one, else the wedding's one RSVP link (#337), where
 * each guest types their number (none while the couple has it off).
 */
export function linkFor(
  send: GuestSend,
  to: Recipient[],
  vaultUrl: string | null,
  weddingRsvpUrl: string | null,
): { line: 'vaultLine' | 'rsvpLine' | 'weddingRsvpLine'; url: string } | null {
  if (send.vault) return vaultUrl ? { line: 'vaultLine', url: vaultUrl } : null;
  if (send.channel === 'each' && to.length === 1) return { line: 'rsvpLine', url: to[0].rsvpUrl };
  return weddingRsvpUrl ? { line: 'weddingRsvpLine', url: weddingRsvpUrl } : null;
}

/** False on the web, in the iOS Simulator, and on a phone with no texting or no Mail account. */
export function canSend(channel: GuestChannel): Promise<boolean> {
  return channel === 'email' ? MailComposer.isAvailableAsync() : SMS.isAvailableAsync();
}

/** Opens Messages (or Mail, BCC) for one batch, with the cards attached. */
export async function openComposer(
  channel: GuestChannel,
  to: Recipient[],
  body: string,
  cards: string[],
  subject: string,
): Promise<ComposerResult> {
  if (channel === 'email') {
    const { status } = await MailComposer.composeAsync({
      bccRecipients: to.flatMap((r) => (r.email ? [r.email] : [])),
      subject,
      body,
      attachments: cards,
    });
    if (status === MailComposer.MailComposerStatus.SENT) return 'sent';
    // Saved as a draft hasn't gone anywhere
    if (status === MailComposer.MailComposerStatus.UNDETERMINED) return 'unknown';
    return 'cancelled';
  }
  const { result } = await SMS.sendSMSAsync(
    to.flatMap((r) => (r.phone ? [r.phone] : [])),
    body,
    {
      attachments: cards.map((uri, index) => ({
        uri,
        mimeType: 'image/png',
        filename: `invitation-${index + 1}.png`,
      })),
    },
  );
  return result;
}
