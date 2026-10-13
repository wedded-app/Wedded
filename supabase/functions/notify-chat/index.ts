// notify-chat: emails whoever has chat messages waiting (the chat_notifications
// migration). pg_cron calls it every 2 minutes; only the service role may.
//
// Each conversation with messages unread for 3 minutes and not yet emailed
// gets one email to the side that hasn't read them. Vendors without an
// account yet get the family's message with an invitation to claim their free
// listing; founders get a copy of those so they can follow up by phone.
//
//   200 { sent, failed }
//   403 { error: 'forbidden' }

import { createClient } from '@supabase/supabase-js';

import { type OutgoingEmail, sendEmail } from '../_shared/inquiry-email.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
  Deno.env.get('SUPABASE_SECRET_KEY') ?? '';

function env(name: string): string | undefined {
  const value = Deno.env.get(name)?.trim();
  return value ? value : undefined;
}

function list(name: string): string[] {
  return (env(name) ?? '').split(',').map((s) => s.trim()).filter(Boolean);
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function roleOf(token: string): string | undefined {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '='))).role;
  } catch {
    return undefined;
  }
}

function escapeHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export type Claim = {
  conversation_id: string;
  notify_side: 'vendor' | 'family';
  recipients: string[];
  vendor_has_account: boolean;
  vendor_name: string;
  vendor_slug: string;
  family_name: string | null;
  unread_count: number;
  last_body: string | null;
  last_kind: string | null;
  notified_at: string;
};

const KIND_TEXT: Record<string, string> = {
  photo: 'sent a photo',
  quote: 'sent a price quote',
  menu: 'shared a menu',
  booking: 'sent their event details',
  // Never the number itself: they open the chat to see it
  phone: 'shared their phone number',
};

/** The email for one claim, or null when there's nobody to send it to. */
export function buildChatEmail(claim: Claim): OutgoingEmail | null {
  const testInbox = env('INQUIRY_TEST_INBOX');
  const founders = list('FOUNDERS_EMAIL');
  const site = env('SITE_URL');
  const from = env('INQUIRY_FROM') ?? 'Wedded App <inquiries@example.com>';
  const family = claim.family_name ?? 'A family';
  const toVendor = claim.notify_side === 'vendor';
  const needsClaim = toVendor && !claim.vendor_has_account;

  let to = claim.recipients;
  if (to.length === 0 && needsClaim) to = founders;
  if (testInbox) to = [testInbox];
  if (to.length === 0) return null;

  const who = toVendor ? family : claim.vendor_name;
  const what = claim.last_kind && claim.last_kind !== 'text'
    ? KIND_TEXT[claim.last_kind] ?? 'sent a message'
    : 'sent you a message';
  const preview = claim.last_body ? claim.last_body.slice(0, 280) : null;
  const more = claim.unread_count > 1 ? ` (${claim.unread_count} new messages)` : '';
  const subject = toVendor
    ? `${family} sent you a message on Wedded App${more}`
    : `${claim.vendor_name} replied on Wedded App${more}`;

  let action: { text: string; url: string | null };
  if (needsClaim) {
    action = {
      text: 'Claim your free listing to reply in the app',
      url: site ? `${site}/for-vendors?claim=${claim.vendor_slug}` : null,
    };
  } else {
    action = { text: 'Open Wedded App to reply', url: site ? `${site}/messages` : null };
  }

  const lines = [
    `${who} ${what}${toVendor ? ` about ${claim.vendor_name}` : ''}:`,
    ...(preview ? ['', `"${preview}"`] : []),
    '',
    action.url ? `${action.text}: ${action.url}` : `${action.text}.`,
    ...(needsClaim ? ['', 'Or reply to this email and we will connect you with the family.'] : []),
    '',
    'Wedded App. Families contact you directly; we never charge for introductions.',
  ];
  const html =
    `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:17px;line-height:1.5;color:#1c1c1e;max-width:560px">
<p style="margin:0 0 12px"><strong>${escapeHtml(who)}</strong> ${escapeHtml(what)}${
      toVendor ? ` about <strong>${escapeHtml(claim.vendor_name)}</strong>` : ''
    }:</p>
${
      preview
        ? `<p style="margin:0 0 16px;padding:12px 16px;background:#f2f2f7;border-radius:12px">${
          escapeHtml(preview)
        }</p>`
        : ''
    }
${
      action.url
        ? `<p style="margin:0 0 16px"><a href="${
          escapeHtml(action.url)
        }" style="display:inline-block;background:#8A1C30;color:#fff;text-decoration:none;padding:12px 20px;border-radius:24px;font-weight:600">${
          escapeHtml(action.text)
        }</a></p>`
        : `<p style="margin:0 0 16px"><strong>${escapeHtml(action.text)}.</strong></p>`
    }
${
      needsClaim
        ? '<p style="margin:0 0 16px">Or reply to this email and we will connect you with the family.</p>'
        : ''
    }
<p style="font-size:14px;color:#6c6c70;margin:0">Wedded App. Families contact you directly; we never charge for introductions.</p>
</div>`;

  return {
    from,
    to,
    cc: [],
    bcc: needsClaim && !testInbox ? founders.filter((f) => !to.includes(f)) : [],
    replyTo: needsClaim ? founders : [],
    subject,
    text: lines.join('\n'),
    html,
  };
}

Deno.serve(async (request) => {
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (token !== SERVICE_KEY && roleOf(token) !== 'service_role') {
    return json({ error: 'forbidden' }, 403);
  }
  const body = await request.json().catch(() => ({}));
  const quiet = typeof body?.quietMinutes === 'number' ? body.quietMinutes : 3;

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.rpc('claim_chat_notifications', {
    p_quiet_minutes: quiet,
  });
  if (error) {
    console.error('claiming chat notifications failed', error);
    return json({ error: 'server_error' }, 500);
  }

  let sent = 0;
  let failed = 0;
  for (const claim of (data ?? []) as Claim[]) {
    const email = buildChatEmail(claim);
    if (!email) continue;
    try {
      await sendEmail(
        email,
        `chat-${claim.conversation_id}-${claim.notify_side}-${claim.notified_at}`,
      );
      sent += 1;
    } catch (e) {
      failed += 1;
      console.error('chat notification failed', claim.conversation_id, e);
    }
  }
  return json({ sent, failed }, 200);
});
