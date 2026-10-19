/**
 * Keep a vendor's availability calendar (docs/RESEARCH_GROWTH.md #5) until
 * vendors have their own accounts. Founders update it after a call or a text
 * with the vendor; every run stamps the calendar as fresh, so their open days
 * show as open for the next 60 days.
 *
 *   npm run availability -- --vendor=<slug> [--local]
 *       [--booked=2027-06-12,2027-06-13] [--held=...]
 *       [--morning=...] [--evening=...]     (booked for that part of the day)
 *       [--open=2027-06-20,...]              (clear those days)
 *       [--list]                             (show the next marked days)
 *
 * Without --local, set SUPABASE_URL and SUPABASE_SECRET_KEY.
 */
import { connect, fail } from './connect';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** "2027-06-12,2027-06-13" → the dates, checked. */
export function parseDates(value: string | undefined, flag: string): string[] {
  if (!value) return [];
  const dates = value
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean);
  for (const date of dates) {
    const parsed = new Date(`${date}T12:00:00Z`);
    if (
      !DATE.test(date) ||
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== date
    ) {
      fail(`${flag}: "${date}" is not a date like 2027-06-12.`);
    }
  }
  return dates;
}

type Mark = { day: string; part: 'all_day' | 'morning' | 'evening'; status: 'booked' | 'held' };

async function main() {
  const args = process.argv.slice(2);
  const value = (name: string) =>
    args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const slug = value('vendor');
  if (!slug) {
    fail(
      'Usage: npm run availability -- --vendor=<slug> --booked=2027-06-12 [--held=…] [--open=…] [--list]',
    );
  }
  const db = connect(args.includes('--local'));
  const { data: vendor } = await db
    .from('vendors')
    .select('id, name')
    .eq('slug', slug)
    .maybeSingle();
  if (!vendor) fail(`No vendor with the slug "${slug}".`);

  const marks: Mark[] = [
    ...parseDates(value('booked'), '--booked').map((day) => ({
      day,
      part: 'all_day' as const,
      status: 'booked' as const,
    })),
    ...parseDates(value('held'), '--held').map((day) => ({
      day,
      part: 'all_day' as const,
      status: 'held' as const,
    })),
    ...parseDates(value('morning'), '--morning').map((day) => ({
      day,
      part: 'morning' as const,
      status: 'booked' as const,
    })),
    ...parseDates(value('evening'), '--evening').map((day) => ({
      day,
      part: 'evening' as const,
      status: 'booked' as const,
    })),
  ];
  const open = parseDates(value('open'), '--open');

  if (open.length > 0) {
    const { error } = await db
      .from('vendor_days')
      .delete()
      .eq('vendor_id', vendor.id)
      .in('day', open);
    if (error) fail(`Could not clear days: ${error.message}`);
  }
  if (marks.length > 0) {
    // A day marked all day replaces its morning/evening marks, and the reverse
    const days = [...new Set(marks.map((m) => m.day))];
    const { error: clearError } = await db
      .from('vendor_days')
      .delete()
      .eq('vendor_id', vendor.id)
      .in('day', days);
    if (clearError) fail(`Could not update days: ${clearError.message}`);
    const { error } = await db
      .from('vendor_days')
      .insert(marks.map((m) => ({ vendor_id: vendor.id, ...m, source: 'founder_whatsapp' })));
    if (error) fail(`Could not save days: ${error.message}`);
  }
  if (marks.length > 0 || open.length > 0 || !args.includes('--list')) {
    const { error } = await db
      .from('vendors')
      .update({ calendar_updated_at: new Date().toISOString() })
      .eq('id', vendor.id);
    if (error) fail(`Could not stamp the calendar: ${error.message}`);
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: upcoming } = await db
    .from('vendor_days')
    .select('day, part, status')
    .eq('vendor_id', vendor.id)
    .gte('day', today)
    .order('day')
    .limit(40);
  console.log(`${vendor.name}: calendar updated. Next marked days:`);
  if (!upcoming || upcoming.length === 0)
    console.log('  none (every day shows as open for 60 days)');
  for (const m of upcoming ?? []) {
    console.log(`  ${m.day}  ${m.status}${m.part === 'all_day' ? '' : ` (${m.part})`}`);
  }
}

if (require.main === module) void main();
