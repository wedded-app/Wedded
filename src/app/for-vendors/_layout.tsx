import { Stack } from 'expo-router';

import { useColors } from '@/constants/theme';

/**
 * List your business: the welcome (index, or the claim form with ?claim=),
 * then one question per screen (name, kind, town) so Back and the swipe-back
 * gesture work like any iPhone app, then their page made (ready). "Leave your
 * number" (call-me) is the founders' form for anyone who'd rather talk first.
 */
export default function ForVendorsLayout() {
  const Colors = useColors();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.canvas } }}>
      <Stack.Screen name="ready" options={{ gestureEnabled: false, animation: 'fade' }} />
    </Stack>
  );
}
