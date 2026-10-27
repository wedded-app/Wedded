// Stop-these-emails links and the footer every Wedded email ends with (#228).
//
// The link carries the address and an HMAC of it, so only someone who got the
// email can stop it. The key is EMAIL_LINK_SECRET, or the service role key
// when that isn't set (it never leaves the server either way). The footer
// names the business: BUSINESS_NAME (default "Wedded App") and BUSINESS_ADDRESS
// (the postal address, required for marketing email once the LLC has one).

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  buildInquiryEmail,
  type InquiryEmailInput,
  type OutgoingEmail,
  sendEmail,
} from './inquiry-email.ts';

function env(name: string): string | undefined {
  const value = Deno.env.get(name)?.trim();
  return value ? value : undefined;
}

function linkKey(): string {
  const key = env('EMAIL_LINK_SECRET') ?? env('SUPABASE_SERVICE_ROLE_KEY') ??
    env('SUPABASE_SECRET_KEY');
  if (!key) throw new Error('No key for email links: set EMAIL_LINK_SECRET');
  return key;
}

function toBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_')
    .replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const base64 = text.replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

export function normalizeEmail(address: string): string {
  const match = /<([^>]+)>\s*$/.exec(address);
  return (match ? match[1] : address).trim().toLowerCase();
}

async function signature(email: string, key: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    new TextEncoder().encode(`unsubscribe:${email}`),
  );
  return toBase64Url(new Uint8Array(mac));
}

/** The query string for one address: `e` (the address) and `t` (its signature). */
export async function signedParams(address: string, key = linkKey()): Promise<string> {
  const email = normalizeEmail(address);
  const e = toBase64Url(new TextEncoder().encode(email));
  return `e=${e}&t=${await signature(email, key)}`;
}

/** The address a link stands for, or null when it was altered. */
export async function verifiedEmail(
  e: string | null,
  t: string | null,
  key = linkKey(),
): Promise<string | null> {
  if (!e || !t || e.length > 400 || t.length > 100) return null;
  let email: string;
  try {
    email = new TextDecoder().decode(fromBase64Url(e));
  } catch {
    return null;
  }
  if (email !== normalizeEmail(email) || !email.includes('@')) return null;
  const expected = await signature(email, key);
  // Compare in constant time
  if (expected.length !== t.length) return null;
  let diff = 0;
  for (let i = 0; i < t.length; i += 1) diff |= expected.charCodeAt(i) ^ t.charCodeAt(i);
  return diff === 0 ? email : null;
}

export function unsubscribeBase(): string {
  const base = env('EMAIL_LINKS_URL') ?? `${env('SUPABASE_URL') ?? ''}/functions/v1`;
  return `${base.replace(/\/$/, '')}/email-unsubscribe`;
}

function escapeHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Who sends the email: "Wedded App · 123 Main St, Yuba City, CA 95991". */
export function businessLine(): string {
  const name = env('BUSINESS_NAME') ?? 'Wedded App';
  const address = env('BUSINESS_ADDRESS') ?? 'Yuba City, California';
  return `${name} · ${address}`;
}

/**
 * Adds the footer for `recipient` (why they get it, how to stop, who sends
 * it). The one-click headers go only on emails nobody else is copied on,
 * blind copies included, so a copied person's mail app can't stop someone
 * else's emails.
 */
export async function withFooter(
  email: OutgoingEmail,
  recipient: string,
  why: string,
): Promise<OutgoingEmail> {
  const url = `${unsubscribeBase()}?${await signedParams(recipient)}`;
  const who = normalizeEmail(recipient);
  const stop = `Stop these emails to ${who}`;
  const text = `${email.text}\n\n--\n${why}\n${stop}: ${url}\n${businessLine()}`;
  const footer =
    `<p style="font-size:13px;line-height:1.5;color:#6c6c70;margin:24px auto 0;max-width:560px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">${
      escapeHtml(why)
    }<br><a href="${escapeHtml(url)}" style="color:#6c6c70">${escapeHtml(stop)}</a><br>${
      escapeHtml(businessLine())
    }</p>`;
  const html = email.html.includes('</body>')
    ? email.html.replace('</body>', `${footer}</body>`)
    : `${email.html}\n${footer}`;
  const alone = email.cc.length === 0 && email.bcc.length === 0 && email.to.length === 1;
  return {
    ...email,
    text,
    html,
    headers: alone
      ? {
        ...email.headers,
        'List-Unsubscribe': `<${url}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      }
      : email.headers,
  };
}

/** Which of these addresses asked for no more email. */
export async function optedOut(
  admin: SupabaseClient,
  addresses: string[],
): Promise<Set<string>> {
  const emails = [...new Set(addresses.map(normalizeEmail))];
  if (emails.length === 0) return new Set();
  const { data, error } = await admin.from('email_opt_outs').select('email').in('email', emails);
  if (error) throw error;
  return new Set((data ?? []).map((row: { email: string }) => row.email));
}

/**
 * The inquiry emails with everyone's wishes applied: first the vendor's (a
 * vendor who stopped emails gets it relayed through the founders, by text or
 * WhatsApp, so the family still reaches them), then the family's own copy.
 * The copy is a separate email so each stop link stops only its reader's
 * emails. No copy for a family who stopped emails, or while the test inbox
 * is on (Resend delivers only there until the domain is verified).
 */
export async function inquiryEmailsFor(
  admin: SupabaseClient,
  input: InquiryEmailInput,
): Promise<OutgoingEmail[]> {
  const family = input.sender.email;
  const stopped = await optedOut(
    admin,
    [input.vendorEmail, family].filter((a): a is string => !!a),
  );
  const vendorStopped = !!input.vendorEmail && stopped.has(normalizeEmail(input.vendorEmail));
  const channel = input.channel === 'email' && vendorStopped ? 'relay' : input.channel;
  const email = buildInquiryEmail({ ...input, channel });
  const why = channel === 'relay'
    ? `You get this because you relay inquiries for ${input.vendorName} on Wedded App.`
    : `You get this because a family asked ${input.vendorName} about their wedding on Wedded App.`;
  const emails = [await withFooter(email, email.to[0], why)];
  if (family && !env('INQUIRY_TEST_INBOX') && !stopped.has(normalizeEmail(family))) {
    emails.push(
      await withFooter(
        { ...email, to: [family], bcc: [], replyTo: [] },
        family,
        `You get this copy because you asked ${input.vendorName} about your wedding on Wedded App.`,
      ),
    );
  }
  return emails;
}

/** Sends an inquiry, then the family's copy. Returns the provider's id for the inquiry. */
export async function sendInquiry(
  admin: SupabaseClient,
  input: InquiryEmailInput,
): Promise<string> {
  const [email, copy] = await inquiryEmailsFor(admin, input);
  const providerId = await sendEmail(email, input.inquiryId);
  if (copy) {
    // The vendor already has the inquiry, so a lost copy only gets logged
    await sendEmail(copy, `${input.inquiryId}-family`).catch((error) =>
      console.error('sending the family copy failed', input.inquiryId, error)
    );
  }
  return providerId;
}
