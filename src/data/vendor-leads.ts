/**
 * "For vendors" sign-ups and "Claim your profile" requests (vision S16g).
 * Insert only: the app can add a lead but never read one back, so there's no
 * .select() after the insert (it would be refused).
 */
import { useMutation } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type VendorLead = {
  businessName: string;
  contactName: string;
  /** What they do, in their own words. */
  category?: string;
  city: string;
  /** E.164, e.g. "+15305550101". */
  phone: string;
  instagramHandle?: string;
  /** Set for "Claim your profile". */
  claimedVendorId?: string;
  language: 'en';
};

async function submitVendorLead(lead: VendorLead) {
  const { error } = await supabase.from('vendor_leads').insert({
    kind: lead.claimedVendorId ? 'claim' : 'new_listing',
    claimed_vendor_id: lead.claimedVendorId ?? null,
    business_name: lead.businessName,
    contact_name: lead.contactName,
    category: lead.category || null,
    city: lead.city,
    phone: lead.phone,
    instagram_handle: lead.instagramHandle || null,
    language: lead.language,
  });
  if (error) throw error;
}

/** Sends a lead to the founders. */
export function useSubmitVendorLead() {
  return useMutation({ mutationFn: submitVendorLead });
}
