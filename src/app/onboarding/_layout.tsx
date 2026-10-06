import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { Palettes, SchemeContext } from '@/constants/theme';

/**
 * The first questions for a family (after the welcome screen, or "Start
 * planning" on Home), one screen each so Back and the swipe-back gesture
 * work like any iPhone app. Always white with black text, in dark mode too,
 * like the welcome screen (Fezy asked for white).
 */
export default function OnboardingLayout() {
  return (
    <SchemeContext.Provider value="light">
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Palettes.light.canvas },
        }}
      >
        <Stack.Screen name="ready" options={{ gestureEnabled: false, animation: 'fade' }} />
      </Stack>
    </SchemeContext.Provider>
  );
}
