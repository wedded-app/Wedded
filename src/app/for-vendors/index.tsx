import { useLocalSearchParams } from 'expo-router';

import { BusinessWelcome } from '@/features/vendor-join/business-welcome';
import { LeadForm } from '@/features/vendor-join/lead-form';

/**
 * S16g List your business (linked from the Vendors tab, Profile and
 * Settings): a welcome over a mehndi artist at work, then three questions
 * that make the business's page. With ?claim={slug} ("Are you this vendor?"
 * on every vendor page) it's the claim form instead. Deep link: /for-vendors.
 */
export default function ForVendorsScreen() {
  const { claim } = useLocalSearchParams<{ claim?: string }>();
  return claim ? <LeadForm claim={claim} /> : <BusinessWelcome />;
}
