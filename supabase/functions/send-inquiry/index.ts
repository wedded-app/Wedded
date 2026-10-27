// send-inquiry: "Ask about price & date" (vision S11 and §8).
//
// POST with the signed-in person's session. The body is an InquiryInput
// (validate.ts). Responses:
//   200 { id, status: 'sent' }      emailed
//   202 { id, status: 'queued' }    the app-wide daily cap is reached; it goes tomorrow
//   400 { error: 'invalid', field } something in the form is wrong
//   401 { error: 'unauthorized' }   not signed in
//   403 { error: 'needs_profile' }  About you isn't filled in
//   404 { error: 'vendor_not_found' }
//   409 { error: 'duplicate', previousAt }   asked this vendor in the last 24 hours;
//                                            resend with sendAgain: true
//   429 { error: 'rate_limited', limit: 'hour' | 'day' }
//   502 { id, status: 'failed', error: 'send_failed' }   saved, but the email failed
//
// The rules live in the database (public.create_inquiry), so they're tested
// with pgTAP and can't be skipped by calling the table directly.

import { createClient } from '@supabase/supabase-js';
import { limitedBody } from '../_shared/body.ts';

import { sendInquiry } from '../_shared/email-links.ts';
import { parseInquiry } from '../_shared/inquiry-input.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
  Deno.env.get('SUPABASE_SECRET_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

type CreateResult =
  | { outcome: 'needs_profile' | 'vendor_not_found' }
  | { outcome: 'invalid'; field: string }
  | { outcome: 'duplicate'; previous_at: string }
  | { outcome: 'rate_limited'; limit: 'hour' | 'day' }
  | {
    outcome: 'created';
    inquiry_id: string;
    status: 'sending' | 'queued';
    channel: 'email' | 'relay';
    vendor_name: string;
    vendor_email: string | null;
    vendor_phone: string | null;
  };

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'unauthorized' }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return json({ error: 'unauthorized' }, 401);
  const user = userData.user;

  const raw = await limitedBody(request, 32768);
  if (raw === null) return json({ error: 'body_too_large' }, 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: 'invalid', field: 'body' }, 400);
  }
  const parsed = parseInquiry(body);
  if (!parsed.ok) return json({ error: 'invalid', field: parsed.field }, 400);
  const inquiry = parsed.value;

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('full_name, city, phone')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError) {
    console.error('profile lookup failed', profileError);
    return json({ error: 'server_error' }, 500);
  }
  if (!profile) return json({ error: 'needs_profile' }, 403);

  const sender = {
    name: inquiry.name ?? profile.full_name,
    phone: inquiry.phone ?? profile.phone,
    email: user.email ?? null,
    city: profile.city,
  };

  const { data, error: createError } = await admin.rpc('create_inquiry', {
    p_user_id: user.id,
    p_vendor_id: inquiry.vendorId,
    p_event_slugs: inquiry.eventSlugs,
    p_event_date: inquiry.eventDate,
    p_start_time: inquiry.startTime,
    p_guest_band: inquiry.guestBand,
    p_location: inquiry.location,
    p_message: inquiry.message,
    p_preferred_contact: inquiry.preferredContact,
    p_details: inquiry.details,
    p_sender_name: sender.name,
    p_sender_phone: sender.phone,
    p_sender_email: sender.email,
    p_send_again: inquiry.sendAgain,
  });
  if (createError) {
    console.error('create_inquiry failed', createError);
    return json({ error: 'server_error' }, 500);
  }

  const result = data as CreateResult;
  switch (result.outcome) {
    case 'needs_profile':
      return json({ error: 'needs_profile' }, 403);
    case 'vendor_not_found':
      return json({ error: 'vendor_not_found' }, 404);
    case 'invalid':
      return json({ error: 'invalid', field: result.field }, 400);
    case 'duplicate':
      return json({ error: 'duplicate', previousAt: result.previous_at }, 409);
    case 'rate_limited':
      return json({ error: 'rate_limited', limit: result.limit }, 429);
  }

  const id = result.inquiry_id;
  if (result.status === 'queued') return json({ id, status: 'queued' }, 202);

  const { data: events } = await admin
    .from('events')
    .select('slug, name')
    .in('slug', inquiry.eventSlugs.length > 0 ? inquiry.eventSlugs : ['']);
  const eventNames = inquiry.eventSlugs.map((slug) => {
    const name = events?.find((event) => event.slug === slug)?.name as { en?: string } | undefined;
    return name?.en ?? slug;
  });

  try {
    const providerId = await sendInquiry(admin, {
      inquiryId: id,
      channel: result.channel,
      vendorName: result.vendor_name,
      vendorEmail: result.vendor_email,
      vendorPhone: result.vendor_phone,
      eventNames,
      inquiry,
      sender,
    });
    await admin
      .from('inquiries')
      .update({
        status: 'sent',
        provider_message_id: providerId,
        sent_at: new Date().toISOString(),
      })
      .eq('id', id);
    return json({ id, status: 'sent' }, 200);
  } catch (sendError) {
    console.error('sending inquiry failed', id, sendError);
    await admin
      .from('inquiries')
      .update({ status: 'failed', failure: String(sendError).slice(0, 500) })
      .eq('id', id);
    return json({ id, status: 'failed', error: 'send_failed' }, 502);
  }
});
