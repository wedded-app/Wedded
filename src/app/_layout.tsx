import { Fraunces_500Medium, Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, type Href, router, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect } from 'react';
import { Platform } from 'react-native';

import { AppIntro } from '@/components/app-intro';
import { WebFrame } from '@/components/web-frame';
import { Radius, useColors, useScheme } from '@/constants/theme';
import { configurePushHandling, usePushOpens } from '@/data/push';
import { queryClient } from '@/data/query-client';
import { WeddingSync } from '@/data/wedding';
import { SessionProvider } from '@/features/auth/session';
import { SearchLocationProvider } from '@/features/location/search-location';
import { SettingsProvider } from '@/features/settings/settings';
import { LocaleProvider } from '@/i18n/locale-context';

SplashScreen.preventAutoHideAsync();
// Message alerts show while the app is open, except for the chat on screen
configurePushHandling();

// iPhones draw Latin text in San Francisco, the system font, so Inter is only
// needed on Android and the web (see fontStyle in constants/theme.ts).
const LATIN_FONTS: Record<string, number> =
  Platform.OS === 'ios'
    ? {}
    : { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold };

export default function RootLayout() {
  // Fonts load at runtime so the app runs in Expo Go, behind the splash
  // screen so no screen ever renders in a system fallback.
  const [fontsLoaded, fontError] = useFonts({
    ...LATIN_FONTS,
    // The display serif for the welcome and phone sign-in screens.
    Fraunces_500Medium,
    Fraunces_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>
        <SettingsProvider>
          <SessionProvider>
            <SearchLocationProvider>
              <AppShell />
            </SearchLocationProvider>
          </SessionProvider>
        </SettingsProvider>
      </LocaleProvider>
    </QueryClientProvider>
  );
}

/** Tapping a message alert opens its chat, including the alert that started the app. */
function PushOpens() {
  const open = useCallback((url: string) => router.push(url as Href), []);
  usePushOpens(open);
  return null;
}

/** The screens, drawn in the colour scheme from Settings > Appearance. */
function AppShell() {
  const Colors = useColors();
  const scheme = useScheme();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  // Navigation's own colours (behind screens during transitions) match ours.
  const theme = {
    ...base,
    colors: {
      ...base.colors,
      primary: Colors.primary,
      background: Colors.bg,
      card: Colors.surface,
      text: Colors.text,
      border: Colors.separator,
    },
  };

  return (
    <ThemeProvider value={theme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <WeddingSync />
      <PushOpens />
      <WebFrame>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.bg } }}>
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          <Stack.Screen name="(business)" options={{ animation: 'fade' }} />
          <Stack.Screen name="welcome" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="auth-callback" options={{ animation: 'none' }} />
          <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="sign-in" options={{ presentation: 'modal' }} />
          <Stack.Screen name="phone-sign-in" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="save-vendor" options={{ presentation: 'modal' }} />
          <Stack.Screen name="suggest" options={{ presentation: 'modal' }} />
          <Stack.Screen name="menu" options={{ presentation: 'modal' }} />
          <Stack.Screen name="location" options={{ presentation: 'modal' }} />
          <Stack.Screen name="filters" options={{ presentation: 'modal' }} />
          <Stack.Screen name="ask" options={{ presentation: 'modal' }} />
          <Stack.Screen name="ask-sent" options={{ presentation: 'modal' }} />
          <Stack.Screen name="delete-account" options={{ presentation: 'modal' }} />
          <Stack.Screen name="chat-quote" options={{ presentation: 'modal' }} />
          <Stack.Screen name="chat-menu" options={{ presentation: 'modal' }} />
          <Stack.Screen name="chat-deposit" options={{ presentation: 'modal' }} />
          <Stack.Screen name="request-new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="business/propose" options={{ presentation: 'modal' }} />
          <Stack.Screen name="business/photo" options={{ presentation: 'modal' }} />
          {/* Half height over the reel, which keeps playing above it */}
          <Stack.Screen
            name="reel-comments"
            options={{
              presentation: 'formSheet',
              sheetAllowedDetents: [0.62, 1],
              sheetGrabberVisible: true,
              sheetCornerRadius: Radius.sheet,
            }}
          />
          <Stack.Screen name="reel-report" options={{ presentation: 'modal' }} />
          <Stack.Screen name="reel-book" options={{ presentation: 'modal' }} />
          <Stack.Screen name="reels-viewer" options={{ animation: 'fade' }} />
          <Stack.Screen name="post-reel" options={{ presentation: 'modal' }} />
          <Stack.Screen name="my-inquiries" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="plan" />
          <Stack.Screen name="plan-events" options={{ presentation: 'modal' }} />
          <Stack.Screen
            name="gallery"
            options={{ presentation: 'fullScreenModal', animation: 'fade' }}
          />
          <Stack.Screen
            name="story"
            options={{ presentation: 'fullScreenModal', animation: 'fade' }}
          />
        </Stack>
      </WebFrame>
      <AppIntro />
    </ThemeProvider>
  );
}
