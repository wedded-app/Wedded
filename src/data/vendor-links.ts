/**
 * Links between vendors (vision §6): a hall's "Approved caterers", the venues
 * a caterer is approved at, and who has worked together. Only links both
 * sides confirmed come back (RLS).
 */
import { useQuery } from '@tanstack/react-query';

import type { LocalizedText } from '@/i18n/localized';
import { supabase } from '@/lib/supabase';

export type LinkedVendor = {
  id: string;
  slug: string;
  name: LocalizedText;
  city: string;
};

export type VendorLinks = {
  /** On a hall: caterers on its approved list. */
  approvedCaterers: LinkedVendor[];
  /** On a caterer: venues that approved them ("Approved at 3 venues"). */
  approvedAt: LinkedVendor[];
  /** Either side: vendors they've worked with. */
  workedWith: LinkedVendor[];
};

type Row = { id: string; slug: string; name: string; city: string };

function toLinked(row: Row): LinkedVendor {
  return {
    id: row.id,
    slug: row.slug,
    name: { en: row.name },
    city: row.city,
  };
}

async function fetchVendorLinks(vendorId: string): Promise<VendorLinks> {
  const { data, error } = await supabase
    .from('vendor_links')
    .select(
      'kind, venue_vendor_id, venue:vendors!vendor_links_venue_vendor_id_fkey(id, slug, name, city), vendor:vendors!vendor_links_vendor_id_fkey(id, slug, name, city)',
    )
    .or(`venue_vendor_id.eq.${vendorId},vendor_id.eq.${vendorId}`);
  if (error) throw error;

  const links: VendorLinks = { approvedCaterers: [], approvedAt: [], workedWith: [] };
  for (const link of data) {
    const isVenue = link.venue_vendor_id === vendorId;
    const other = isVenue ? link.vendor : link.venue;
    if (!other) continue;
    if (link.kind === 'approved_at') {
      (isVenue ? links.approvedCaterers : links.approvedAt).push(toLinked(other));
    } else {
      links.workedWith.push(toLinked(other));
    }
  }
  return links;
}

/** The vendor's confirmed links, for its profile page. */
export function useVendorLinks(vendorId: string) {
  return useQuery({
    queryKey: ['vendor-links', vendorId],
    queryFn: () => fetchVendorLinks(vendorId),
    enabled: vendorId.length > 0,
  });
}
