/**
 * The founders' numbers (docs/RESEARCH_GROWTH.md #3), as plain text ready to
 * paste into WhatsApp or an email.
 *
 *   npm run report -- [--local] [--days=7]
 *     The week: new families, inquiries and follow-up answers, saves, shared
 *     plans, new vendor sign-ups, and the most viewed and called vendors.
 *
 *   npm run report -- --vendor=<slug> [--month=2026-10] [--local]
 *     One vendor's monthly scorecard (vision idea 1), written to send to them:
 *     views, calls, saves, inquiries and how many families say they replied.
 *
 * --local uses the local database; otherwise SUPABASE_URL and
 * SUPABASE_SECRET_KEY (the service role key; never commit it).
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { connect, fail } from './connect';

const TZ = 'America/Los_Angeles';

/** Today's date in California, yyyy-mm-dd. */
export function californiaDate(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(date);
}

/** The first and last day of a month like "2026-10". */
export function monthRange(month: string): { from: string; to: string; label: string } {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) fail(`--month must look like 2026-10, not "${month}".`);
  const year = Number(match[1]);
  const m = Number(match[2]);
  const last = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const label = new Date(Date.UTC(year, m - 1, 1)).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}`, label };
}

type Scorecard = {
  views: number;
  calls: number;
  texts: number;
  whatsapps: number;
  directions: number;
  shares: number;
  saves: number;
  inquiries: number;
  replied: number;
  answered: number;
};

/** The message to send a vendor (kept short; vendors read it on the phone). */
export function scorecardMessage(name: string, label: string, s: Scorecard): string {
  const contacts = s.calls + s.texts + s.whatsapps;
  const lines = [
    `${name}: your Wedded App numbers for ${label}`,
    '',
    `${s.views} families viewed your page`,
    `${contacts} tapped to call, text or WhatsApp you`,
    `${s.directions} asked for directions`,
    `${s.saves} saved you for their wedding`,
    `${s.inquiries} sent you an inquiry`,
  ];
  if (s.answered > 0) {
    lines.push(`${s.replied} of ${s.answered} families who told us say you replied`);
  }
  if (s.views < 20) {
    lines.push('', 'Tip: pages with a starting price and 6+ photos get the most calls.');
  }
  lines.push('', 'Reply to this message with any changes to your page.');
  return lines.join('\n');
}

async function vendorScorecard(db: SupabaseClient, slug: string, month: string) {
  const { data: vendor } = await db
    .from('vendors')
    .select('id, name')
    .eq('slug', slug)
    .maybeSingle();
  if (!vendor) fail(`No vendor with the slug "${slug}".`);
  const { from, to, label } = monthRange(month);
  const { data, error } = await db.rpc('vendor_scorecard', {
    p_vendor_id: vendor.id,
    p_from: from,
    p_to: to,
  });
  if (error) fail(`Could not read the scorecard: ${error.message}`);
  console.log(scorecardMessage(vendor.name as string, label, data[0] as Scorecard));
}

async function count(db: SupabaseClient, table: string, since: string, extra?: (q: any) => any) {
  let query = db.from(table).select('*', { count: 'exact', head: true }).gte('created_at', since);
  if (extra) query = extra(query);
  const { count: n, error } = await query;
  return error ? null : (n ?? 0);
}

async function weekly(db: SupabaseClient, days: number) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const out: string[] = [`Wedded App: the last ${days} days (to ${californiaDate()})`, ''];
  const line = (label: string, value: number | null) =>
    out.push(`${label}: ${value === null ? 'n/a' : value}`);

  line('New families (finished sign-up)', await count(db, 'profiles', since));
  line('Inquiries sent', await count(db, 'inquiries', since, (q) => q.eq('status', 'sent')));
  line(
    'Inquiries waiting (queued)',
    await count(db, 'inquiries', since, (q) => q.eq('status', 'queued')),
  );
  line(
    'Inquiries that failed',
    await count(db, 'inquiries', since, (q) => q.eq('status', 'failed')),
  );
  line('Vendors saved', await count(db, 'saved_vendors', since));
  line('Plans shared with family', await count(db, 'weddings', since));
  line('New vendor sign-ups and claims', await count(db, 'vendor_leads', since));

  const { data: answers } = await db
    .from('followups')
    .select('answer')
    .eq('question', 'did_they_reply')
    .gte('answered_at', since)
    .not('answer', 'is', null);
  if (answers) {
    const by = (a: string) => answers.filter((r) => r.answer === a).length;
    out.push(
      `Follow-up answers: ${by('booked')} booked, ${by('deciding')} replied and deciding, ${by('no_reply')} no reply yet`,
    );
  }

  const { data: leads } = await db
    .from('vendor_leads')
    .select('business_name, city, kind, stage')
    .gte('created_at', since)
    .order('created_at');
  if (leads && leads.length > 0) {
    out.push('', 'New vendor sign-ups (phone numbers are in Studio):');
    for (const lead of leads) {
      out.push(
        `- ${lead.business_name}, ${lead.city}${lead.kind === 'claim' ? ' (claim)' : ''} [${lead.stage}]`,
      );
    }
  }

  const sinceDay = californiaDate(new Date(Date.now() - days * 86_400_000));
  const { data: activity } = await db
    .from('vendor_activity_daily')
    .select('kind, count, vendor:vendors(name)')
    .gte('day', sinceDay);
  if (activity && activity.length > 0) {
    const totals = new Map<string, { views: number; contacts: number }>();
    for (const row of activity as unknown as {
      kind: string;
      count: number;
      vendor: { name: string } | null;
    }[]) {
      const name = row.vendor?.name ?? 'Unknown';
      const t = totals.get(name) ?? { views: 0, contacts: 0 };
      if (row.kind === 'view') t.views += row.count;
      if (['call', 'text', 'whatsapp'].includes(row.kind)) t.contacts += row.count;
      totals.set(name, t);
    }
    out.push('', 'Most viewed vendors:');
    [...totals.entries()]
      .sort((a, b) => b[1].views - a[1].views)
      .slice(0, 10)
      .forEach(([name, t], i) =>
        out.push(`${i + 1}. ${name}: ${t.views} views, ${t.contacts} calls/texts`),
      );
  }

  console.log(out.join('\n'));
}

async function main() {
  const args = process.argv.slice(2);
  const value = (name: string) =>
    args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const db = connect(args.includes('--local'));
  const vendor = value('vendor');
  if (vendor) {
    await vendorScorecard(db, vendor, value('month') ?? californiaDate().slice(0, 7));
  } else {
    const days = Number(value('days') ?? 7);
    if (!Number.isInteger(days) || days < 1 || days > 365) fail('--days must be 1 to 365.');
    await weekly(db, days);
  }
}

if (require.main === module) void main();
