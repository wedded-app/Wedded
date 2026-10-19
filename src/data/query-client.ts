import NetInfo from '@react-native-community/netinfo';
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

/**
 * The app's one TanStack Query client: it caches every database read, so going
 * back to a screen shows what it had straight away. Individual hooks set their
 * own freshness; reference data (events, categories) stays fresh for a day.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Two quick retries, then the screen shows its error state with Try again.
      retry: 2,
      staleTime: 60 * 1000,
    },
    // A save always tries once, then succeeds or fails where the person can
    // see it. Waiting for "online" kept it only in memory: closing the app
    // lost it, and the phone's offline check can be wrong (seen in the
    // simulator, where the edit never went though the server was reachable).
    mutations: { networkMode: 'offlineFirst' },
  },
});

// React Native has no window focus: treat the app coming to the foreground as
// focus, so stale data refreshes when someone returns to the app.
if (Platform.OS !== 'web') {
  focusManager.setEventListener((setFocused) => {
    const subscription = AppState.addEventListener('change', (state) => {
      setFocused(state === 'active');
    });
    return () => subscription.remove();
  });
  // Offline, reads wait (keeping what's on screen) and run again once the
  // phone is back online, instead of failing; OfflineBanner says so. Saves
  // don't wait (above). The web
  // build already follows the browser's online state.
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => setOnline(state.isConnected !== false)),
  );
}
