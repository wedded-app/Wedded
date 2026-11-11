import { Stack } from 'expo-router';

import { useColors } from '@/constants/theme';

/**
 * Ask for a quote: five short pages in their own stack inside the modal, so
 * Back and the swipe back move between them like any iPhone app. They follow
 * the phone's light or dark setting.
 */
export default function AskLayout() {
  const Colors = useColors();
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.canvas } }}
    />
  );
}
