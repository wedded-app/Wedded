// send-queued-inquiries: sends inquiries that were queued because the
// app-wide daily email cap was reached (vision §8: "queued, sent after
// midnight by pg_cron"). The database's pg_cron job calls it every night; see
// the send_queued_inquiries migration. Only the service role may call it.
//
// It sends the oldest queued inquiries first, up to what's left of today's
// cap, each exactly like send-inquiry does (same booking-sheet email), and
// claims each row before sending so two runs can't send the same one.
//
//   200 { sent, failed, stillQueued }
//   403 { error: 'forbidden' }

import { createClient } from '@supabase/supabase-js';
import { isServiceRequest } from '../_shared/request-security.ts';

import { sendInquiry } from '../_shared/email-links.ts';
import type { Contact, GuestBand, InquiryInput } from '../_shared/inquiry-input.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
  Deno.env.get('SUPABASE_SECRET_KEY') ?? '';

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!isServiceRequest(request, SERVICE_KEY)) {
    return json({ error: 'forbidden' }, 403);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // The same count create_inquiry uses: today's California day, by send time
  const { data: left, error: leftError } = await admin.rpc('inquiry_emails_left_today');
  if (leftError) {
    console.error('reading the daily cap failed', leftError);
    return json({ error: 'server_error' }, 500);
  }
  const room = typeof left === 'number' ? left : 0;

  const { data: queued, error: queuedError } = await admin
    .from('inquiries')
    .select(
      'id, user_id, vendor_id, kind, event_date, start_time, guest_band, venue_text, message, preferred_contact, answers, sender_name, sender_phone, sender_email, channel, inquiry_events(event_slug, position), tour_slots(rank, day, part), city:cities(name), venue:vendors!inquiries_venue_id_fkey(name)',
    )
    .eq('status', 'queued')
    .order('created_at')
    .limit(room);
  if (queuedError) {
    console.error('reading the queue failed', queuedError);
    return json({ error: 'server_error' }, 500);
  }

  let sent = 0;
  let failed = 0;
  for (const row of queued ?? []) {
    // Claim it: only one run can move it from queued to sending
    const { data: claimed } = await admin
      .from('inquiries')
      .update({ status: 'sending' })
      .eq('id', row.id)
      .eq('status', 'queued')
      .select('id');
    if (!claimed || claimed.length === 0) continue;

    // One-to-one embeds come back as objects; the untyped client calls them lists
    const venue = row.venue as unknown as { name: string } | null;
    const city = row.city as unknown as { name: string } | null;
    const place: string = venue?.name ?? row.venue_text ?? city?.name ?? '';
    // The events in the order the family picked them
    const eventSlugs: string[] = [...(row.inquiry_events ?? [])]
      .sort((a: { position: number }, b: { position: number }) => a.position - b.position)
      .map((e: { event_slug: string }) => e.event_slug);
    // A tour's visit times, in the family's order, as the app sent them
    const tourSlots = [...(row.tour_slots ?? [])]
      .sort((a: { rank: number }, b: { rank: number }) => a.rank - b.rank)
      .map((s: { day: string; part: string }) => ({ date: s.day, part: s.part }));

    try {
      const [{ data: vendor }, { data: vendorPrivate }, { data: events }, { data: profile }] =
        await Promise.all([
          admin.from('vendors').select('name, vendor_contacts(kind, value)').eq(
            'id',
            row.vendor_id,
          ).single(),
          admin.from('vendor_private').select('email').eq('vendor_id', row.vendor_id)
            .maybeSingle(),
          admin.from('events').select('slug, name').in(
            'slug',
            eventSlugs.length > 0 ? eventSlugs : [''],
          ),
          row.user_id
            ? admin.from('profiles').select('city').eq('id', row.user_id).maybeSingle()
            : Promise.resolve({ data: null }),
        ]);
      if (!vendor || !row.sender_name || !row.sender_phone) {
        throw new Error('The vendor or the sender is gone');
      }
      const phone = (kind: string) =>
        vendor.vendor_contacts.find((c: { kind: string }) => c.kind === kind)?.value ?? null;

      const inquiry: InquiryInput = {
        vendorId: row.vendor_id,
        eventSlugs,
        eventDate: row.event_date,
        startTime: row.start_time ? String(row.start_time).slice(0, 5) : null,
        guestBand: row.guest_band as GuestBand,
        location: place,
        message: row.message,
        preferredContact: row.preferred_contact as Contact,
        details: {
          ...((row.answers ?? {}) as Record<string, unknown>),
          ...(row.kind === 'tour' ? { tour: true } : {}),
          ...(tourSlots.length > 0 ? { tourSlots } : {}),
        },
        name: row.sender_name,
        phone: row.sender_phone,
        sendAgain: false,
      };
      const providerId = await sendInquiry(admin, {
        inquiryId: row.id,
        channel: row.channel === 'relay' ? 'relay' : 'email',
        vendorName: vendor.name,
        vendorEmail: vendorPrivate?.email ?? null,
        vendorPhone: phone('whatsapp') ?? phone('text') ?? phone('call'),
        eventNames: eventSlugs.map((slug: string) => {
          const name = events?.find((event) => event.slug === slug)?.name as
            | { en?: string }
            | undefined;
          return name?.en ?? slug;
        }),
        inquiry,
        sender: {
          name: row.sender_name,
          phone: row.sender_phone,
          email: row.sender_email,
          city: profile?.city ?? place,
        },
      });
      await admin
        .from('inquiries')
        .update({
          status: 'sent',
          provider_message_id: providerId,
          sent_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      sent += 1;
    } catch (sendError) {
      console.error('sending queued inquiry failed', row.id, sendError);
      await admin
        .from('inquiries')
        .update({ status: 'failed', failure: String(sendError).slice(0, 500) })
        .eq('id', row.id);
      failed += 1;
    }
  }

  const { count } = await admin
    .from('inquiries')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'queued');
  return json({ sent, failed, stillQueued: count ?? 0 }, 200);
});
