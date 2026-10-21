import { Stack } from 'expo-router';

import { useColors } from '@/constants/theme';

// Vendors is the first screen of this tab's stack, so a deep link to Search,
// results or Requests still has Vendors underneath it.
export const unstable_settings = {
  anchor: 'vendors',
};

/**
 * The Vendors tab's stack: Vendors, then Search, results and Requests pushed
 * on top with the tab bar still showing. Results are shared with Home through
 * the (home,search) group.
 */
export default function SearchStackLayout() {
  const Colors = useColors();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.bg } }} />
  );
}
