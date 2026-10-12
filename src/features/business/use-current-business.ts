import { useIsVendor } from '@/data/chat';

/**
 * The business the "My business" screens are about: the first one the
 * signed-in person runs. (Tab 1's useMyBusinesses() will add names and a
 * choice for someone who runs several.)
 */
export function useCurrentBusiness() {
  const { vendorIds, isVendor, isPending } = useIsVendor();
  return { vendorId: vendorIds[0] ?? '', isVendor, isPending };
}
