// First, so errors while the other modules load are reported too
import { reportCrash } from '@/lib/crash-reports';

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
import {
  DarkTheme,
  DefaultTheme,
  type ErrorBoundaryProps,
  type Href,
  router,
  Stack,
  ThemeProvider,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect } from 'react';
import { Platform, View } from 'react-native';

import { AppIntro } from '@/components/app-intro';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { OfflineBanner } from '@/components/offline-banner';
import { WebFrame } from '@/components/web-frame';
import { Radius, Spacing, useColors, useScheme } from '@/constants/theme';
import { configurePushHandling, usePushOpens } from '@/data/push';
import { queryClient } from '@/data/query-client';
import { WeddingSync } from '@/data/wedding';
import { SessionProvider } from '@/features/auth/session';
import { SearchLocationProvider } from '@/features/location/search-location';
import { SettingsProvider } from '@/features/settings/settings';
import { i18n } from '@/i18n';
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

/**
 * A page that crashed shows this instead of a blank screen: what happened in
 * plain words, and Try again, which draws it again. It stands in for the
 * whole app, so it uses no provider (the strings come straight from i18n).
 * The error goes to Sentry, without personal details (lib/crash-reports).
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const Colors = useColors();
  useEffect(() => {
    reportCrash(error);
  }, [error]);
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.lg,
        padding: Spacing.xl,
        backgroundColor: Colors.bg,
      }}
    >
      <AppText variant="title" accessibilityRole="header" style={{ textAlign: 'center' }}>
        {i18n.t('crash.title')}
      </AppText>
      <AppText color="text2" style={{ textAlign: 'center' }}>
        {i18n.t('crash.body')}
      </AppText>
      <Button label={i18n.t('states.tryAgain')} onPress={() => void retry()} />
    </View>
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
          <Stack.Screen name="group-new" options={{ presentation: 'modal' }} />
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
          <Stack.Screen name="post-story" options={{ presentation: 'modal' }} />
          <Stack.Screen name="stories" options={{ presentation: 'modal' }} />
          <Stack.Screen name="my-inquiries" />
          <Stack.Screen name="saved" />
          <Stack.Screen name="settings" />
          {/* Wed: connecting an app, and talking to Wed full screen */}
          <Stack.Screen name="wed-connect" options={{ presentation: 'modal' }} />
          <Stack.Screen
            name="wed-voice"
            options={{ presentation: 'fullScreenModal', animation: 'fade' }}
          />
          <Stack.Screen name="plan" />
          <Stack.Screen name="plan-events" options={{ presentation: 'modal' }} />
          <Stack.Screen name="cards" />
          <Stack.Screen
            name="gallery"
            options={{ presentation: 'fullScreenModal', animation: 'fade' }}
          />
          <Stack.Screen
            name="story"
            options={{ presentation: 'fullScreenModal', animation: 'fade' }}
          />
          <Stack.Screen
            name="vault-viewer"
            options={{ presentation: 'fullScreenModal', animation: 'fade' }}
          />
          <Stack.Screen name="vault-settings" options={{ presentation: 'modal' }} />
        </Stack>
      </WebFrame>
      <OfflineBanner />
      <AppIntro />
    </ThemeProvider>
  );
}
