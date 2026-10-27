// The inquiry email and how it's sent.
//
// Who it goes to (vision §8, S11):
// - to the vendor, with reply-to set to the family and a copy to the family;
//   founders get a blind copy
// - relay: the vendor doesn't use email, so it goes to the founders, who
//   forward it by WhatsApp or text
// - test inbox: while there's no verified sending domain (Phase 5), set
//   INQUIRY_TEST_INBOX and every vendor email goes there alone, with no copy
//   to the family or the founders: Resend refuses any other address until
//   then. Without INQUIRY_FROM it's sent from Resend's test address.
//
// How it's sent: Resend when RESEND_API_KEY is set (production), otherwise
// the local Mailpit when MAILPIT_URL is set (npm run db:start).

import type { Contact, GuestBand, InquiryInput } from './inquiry-input.ts';

export type OutgoingEmail = {
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  replyTo: string[];
  subject: string;
  text: string;
  html: string;
  /** Extra headers, such as List-Unsubscribe (email-links.ts) */
  headers?: Record<string, string>;
};

const GUEST_LABELS: Record<GuestBand, string> = {
  under_50: 'Under 50',
  '50_100': '50 to 100',
  '100_250': '100 to 250',
  '250_500': '250 to 500',
  '500_plus': '500 or more',
  not_sure: 'Not sure yet',
};

const CONTACT_LABELS: Record<Contact, string> = {
  call: 'Call',
  text: 'Text',
  whatsapp: 'WhatsApp',
  email: 'Email',
};

function env(name: string): string | undefined {
  const value = Deno.env.get(name)?.trim();
  return value ? value : undefined;
}

function list(name: string): string[] {
  return (env(name) ?? '')
    .split(',')
    .map((address) => address.trim())
    .filter(Boolean);
}

/** "2027-06-13" as "Sat, Jun 13, 2027" (a calendar date, so no time zone shift). */
export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

/** "19:30" as "7:30 PM". */
export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const suffix = hours < 12 ? 'AM' : 'PM';
  return `${hours % 12 === 0 ? 12 : hours % 12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

function formatPhone(e164: string): string {
  const us = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return us ? `(${us[1]}) ${us[2]}-${us[3]}` : e164;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** "Harjit Kaur" as "Harjit K." */
function shortName(name: string): string {
  const [first, ...rest] = name.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0].toUpperCase()}.` : first;
}

/** " (530)" for a US or Canada number, else nothing. */
function areaCode(e164: string): string {
  const us = /^\+1(\d{3})/.exec(e164);
  return us ? ` (${us[1]})` : '';
}

const DETAIL_VALUES: Record<string, Record<string, string>> = {
  catering: {
    in_house: "The hall's food",
    own: 'Bringing their own caterer',
    not_sure: 'Not sure',
  },
  alcohol: { yes: 'Yes', no: 'No', not_sure: 'Not sure' },
  food: { veg: 'Veg only', veg_nonveg: 'Veg and non-veg', jhatka: 'Jhatka', halal: 'Halal' },
};

const yesNo = (value: unknown) => (value === true ? 'Yes' : value === false ? 'No' : null);

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** The category answers (inquiry.details) as booking-sheet rows; unknown keys are skipped. */
export function detailRows(details: Record<string, unknown>): [string, string][] {
  const rows: [string, string][] = [];
  const text = (value: unknown) => (typeof value === 'string' ? value.slice(0, 80) : null);

  if (Array.isArray(details.tourSlots) && details.tourSlots.length > 0) {
    const slots = details.tourSlots
      .slice(0, 3)
      .filter((slot): slot is { date: string; part: string } =>
        typeof slot?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(slot.date) &&
        typeof slot?.part === 'string'
      )
      .map((slot) => `${formatDate(slot.date)} (${slot.part})`);
    if (slots.length > 0) rows.push(['Could visit', slots.join('; ')]);
  }
  const catering = DETAIL_VALUES.catering[String(details.catering)];
  if (catering) {
    const caterer = text(details.ownCaterer);
    rows.push([
      'Food',
      details.catering === 'own' && caterer ? `${catering}: ${caterer}` : catering,
    ]);
  }
  const alcohol = DETAIL_VALUES.alcohol[String(details.alcohol)];
  if (alcohol) rows.push(['Alcohol', alcohol]);
  const ghoriDhol = yesNo(details.ghoriDhol);
  if (ghoriDhol) rows.push(['Baraat with ghori and dhol', ghoriDhol]);
  const sameDay = yesNo(details.sameDay);
  if (sameDay) rows.push(['Lunch and evening same day', sameDay]);
  const food = DETAIL_VALUES.food[String(details.food)];
  if (food) rows.push(['Food', food]);
  if (Array.isArray(details.liveStations) && details.liveStations.length > 0) {
    rows.push([
      'Live counters',
      details.liveStations.filter((s) => typeof s === 'string').slice(0, 10).map(capitalise).join(
        ', ',
      ),
    ]);
  }
  const hall = text(details.hall);
  if (hall) rows.push(['Hall', hall]);
  const tasting = yesNo(details.tasting);
  if (tasting) rows.push(['Tasting', tasting]);
  return rows;
}

/**
 * The date of each asked-about event, from the family's plan
 * (details.eventDates, { slug: 'yyyy-mm-dd' }), as "Jaago: Fri, Jun 11, 2027".
 * Null when there's nothing to add beyond the one Date row.
 */
export function eventDatesRow(
  eventSlugs: string[],
  eventNames: string[],
  details: Record<string, unknown>,
  eventDate: string | null,
): [string, string] | null {
  const dates = details.eventDates;
  if (!dates || typeof dates !== 'object' || Array.isArray(dates)) return null;
  const known = dates as Record<string, unknown>;
  const lines = eventSlugs.flatMap((slug, i) => {
    const date = known[slug];
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
    return [{ name: eventNames[i] ?? slug, date }];
  });
  if (lines.length === 0) return null;
  // One event on the inquiry's own date says nothing new
  if (lines.length === 1 && eventSlugs.length === 1 && lines[0].date === eventDate) return null;
  return [
    lines.length === 1 ? 'Event date' : 'Event dates',
    lines.map((line) => `${line.name}: ${formatDate(line.date)}`).join('; '),
  ];
}

export type InquiryEmailInput = {
  inquiryId: string;
  channel: 'email' | 'relay';
  vendorName: string;
  vendorEmail: string | null;
  vendorPhone: string | null;
  eventNames: string[];
  inquiry: InquiryInput;
  sender: { name: string; phone: string; email: string | null; city: string };
};

export function buildInquiryEmail(input: InquiryEmailInput): OutgoingEmail {
  const { inquiry, sender } = input;
  const founders = list('FOUNDERS_EMAIL');
  const testInbox = env('INQUIRY_TEST_INBOX');

  let to: string[];
  if (input.channel === 'relay') {
    to = testInbox ? [testInbox] : founders;
  } else {
    to = testInbox ? [testInbox] : input.vendorEmail ? [input.vendorEmail] : [];
  }
  if (to.length === 0) {
    throw new Error(
      input.channel === 'relay'
        ? 'Relay inquiry but FOUNDERS_EMAIL is not set'
        : 'Vendor has no email address',
    );
  }

  // Replies to Apple's private relay addresses bounce, so vendors reply by phone instead
  const replyable = sender.email && !sender.email.endsWith('@privaterelay.appleid.com');

  const isTour = inquiry.details.tour === true;
  const eventList = input.eventNames.length > 0 ? input.eventNames.join(' + ') : 'Wedding';
  const date = inquiry.eventDate ? formatDate(inquiry.eventDate) : 'Date not fixed yet';
  const time = inquiry.startTime ? ` (around ${formatTime(inquiry.startTime)})` : '';
  const guests = GUEST_LABELS[inquiry.guestBand];
  const firstName = sender.name.split(' ')[0];
  const phone = formatPhone(sender.phone);

  // The booking sheet subject (vision §10): "Jaago · Sat, Jun 13, 2027 ·
  // Yuba City · 100 to 250 guests · from Harjit K. (530)"
  let subject = [
    ...(isTour ? ['Tour request'] : []),
    eventList,
    inquiry.eventDate ? formatDate(inquiry.eventDate) : 'date not fixed',
    inquiry.location,
    inquiry.guestBand === 'not_sure' ? 'guests not sure' : `${guests.toLowerCase()} guests`,
    `from ${shortName(sender.name)}${areaCode(sender.phone)}`,
  ].join(' · ');
  if (input.channel === 'relay') subject = `[Forward to ${input.vendorName}] ${subject}`;

  const notes: string[] = [];
  if (testInbox && input.channel === 'email') {
    notes.push(
      `TEST MODE: in production this goes to ${input.vendorName} at ${input.vendorEmail}.`,
    );
  }
  if (input.channel === 'relay') {
    notes.push(
      `${input.vendorName} doesn't use email. Please forward this by WhatsApp or text` +
        (input.vendorPhone ? ` to ${formatPhone(input.vendorPhone)}.` : '.'),
    );
  }

  const rows: [string, string][] = [
    ['Events', input.eventNames.length > 0 ? input.eventNames.join(', ') : 'Not sure yet'],
    ['Date', `${date}${time}`],
    ...[
      eventDatesRow(inquiry.eventSlugs, input.eventNames, inquiry.details, inquiry.eventDate),
    ].filter((row): row is [string, string] => row !== null),
    ['Guests', guests],
    ['Where', inquiry.location],
    ...detailRows(inquiry.details),
    ['Best way to reply', CONTACT_LABELS[inquiry.preferredContact]],
  ];
  if (sender.email) rows.push(['Email', sender.email]);

  const digits = sender.phone.replace(/\D/g, '');
  const replyLinks: [string, string][] = [
    ['Call', `tel:${sender.phone}`],
    ['Text', `sms:${sender.phone}`],
    ['WhatsApp', `https://wa.me/${digits}`],
  ];

  const heading = isTour
    ? `${sender.name} (${sender.city}) would like to visit ${input.vendorName}`
    : `New inquiry for ${input.vendorName} from ${sender.name} (${sender.city})`;

  const text = [
    ...notes,
    ...(notes.length > 0 ? [''] : []),
    `${heading}.`,
    '',
    `Phone: ${phone}`,
    '',
    ...rows.map(([label, value]) => `${label}: ${value}`),
    '',
    'Message:',
    inquiry.message,
    '',
    replyable
      ? `Reply to this email, or contact ${firstName} directly by ${
        CONTACT_LABELS[inquiry.preferredContact].toLowerCase()
      }: ${phone}.`
      : `Please contact ${firstName} by phone: ${phone}.`,
    '',
    '--',
    `Sent through Wedded App. Families contact you directly; we never charge for introductions. Reference: ${input.inquiryId}`,
  ].join('\n');

  const button = (label: string, href: string) =>
    `<a href="${
      escapeHtml(href)
    }" style="display:inline-block;margin:0 8px 8px 0;padding:12px 18px;background:#8a1c30;color:#ffffff;border-radius:10px;font-size:16px;font-weight:bold;text-decoration:none;">${
      escapeHtml(label)
    }</a>`;

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#fdf8f0;font-family:Arial,Helvetica,sans-serif;color:#2b1a12;">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px;">
${
    notes.map((note) =>
      `<p style="margin:0 0 12px;padding:10px 12px;background:#fdecc8;border-radius:8px;font-size:15px;">${
        escapeHtml(note)
      }</p>`
    ).join('\n')
  }
<h1 style="font-size:20px;margin:0 0 12px;">${escapeHtml(heading)}</h1>
<p style="font-size:30px;font-weight:bold;letter-spacing:1px;margin:0 0 12px;">${
    escapeHtml(phone)
  }</p>
<p style="margin:0 0 16px;">${
    replyLinks.map(([label, href]) => button(`Reply by ${label}`, href)).join('')
  }</p>
<table style="border-collapse:collapse;font-size:16px;margin:0 0 16px;">
${
    rows.map(([label, value]) =>
      `<tr><td style="padding:6px 16px 6px 0;color:#5c4a40;vertical-align:top;">${
        escapeHtml(label)
      }</td><td style="padding:6px 0;font-weight:bold;">${escapeHtml(value)}</td></tr>`
    ).join('\n')
  }
</table>
<p style="font-size:16px;line-height:1.5;margin:0 0 16px;white-space:pre-wrap;">${
    escapeHtml(inquiry.message)
  }</p>
<p style="font-size:14px;color:#5c4a40;margin:0;">Sent through Wedded App. Families contact you directly; we never charge for introductions. Reference: ${
    escapeHtml(input.inquiryId)
  }</p>
</div></body></html>`;

  return {
    from: env('INQUIRY_FROM') ?? 'Wedded App <onboarding@resend.dev>',
    to,
    cc: sender.email && !testInbox ? [sender.email] : [],
    bcc: testInbox ? [] : founders.filter((address) => !to.includes(address)),
    replyTo: replyable && sender.email ? [sender.email] : [],
    subject,
    text,
    html,
  };
}

/** "Name <email@example.com>" as its parts. */
function splitAddress(address: string): { Email: string; Name?: string } {
  const match = /^(.*)<([^>]+)>\s*$/.exec(address);
  return match ? { Name: match[1].trim(), Email: match[2].trim() } : { Email: address.trim() };
}

/** Sends the email and returns the provider's message id. `idempotencyKey` is the inquiry id. */
export async function sendEmail(email: OutgoingEmail, idempotencyKey: string): Promise<string> {
  const resendKey = env('RESEND_API_KEY');
  if (resendKey) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        from: email.from,
        to: email.to,
        cc: email.cc.length > 0 ? email.cc : undefined,
        bcc: email.bcc.length > 0 ? email.bcc : undefined,
        reply_to: email.replyTo.length > 0 ? email.replyTo : undefined,
        subject: email.subject,
        text: email.text,
        html: email.html,
        headers: email.headers,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || typeof result.id !== 'string') {
      throw new Error(`Resend ${response.status}: ${JSON.stringify(result).slice(0, 300)}`);
    }
    return result.id;
  }

  const mailpit = env('MAILPIT_URL');
  if (mailpit) {
    const response = await fetch(`${mailpit}/api/v1/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        From: splitAddress(email.from),
        To: email.to.map((address) => ({ Email: address })),
        Cc: email.cc.map((address) => ({ Email: address })),
        Bcc: email.bcc,
        ReplyTo: email.replyTo.map((address) => ({ Email: address })),
        Subject: email.subject,
        Text: email.text,
        HTML: email.html,
        Headers: { ...email.headers, 'X-Inquiry-Id': idempotencyKey },
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || typeof result.ID !== 'string') {
      throw new Error(`Mailpit ${response.status}: ${JSON.stringify(result).slice(0, 300)}`);
    }
    return result.ID;
  }

  throw new Error('No email provider: set RESEND_API_KEY (or MAILPIT_URL locally)');
}
