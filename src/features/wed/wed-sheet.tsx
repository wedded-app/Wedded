import { router, useNavigation } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState, type ReactNode } from 'react';
import { Platform, StyleSheet } from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaFrame,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { CloseWedProvider } from './close-wed';

/**
 * Wed as a sheet on a phone, around Wed's own stack (src/app/wed/_layout).
 * The root stack presents Wed's routes as a modal (src/app/_layout), so on
 * iPhone this is iOS's own sheet: it slides up on iOS's curve over the tab
 * or page it opened from, which steps back behind it, and a swipe down
 * closes it. Android slides it up from the bottom, full screen, and Back
 * closes it. Either way the page underneath stays as it was.
 *
 * On iPhone the sheet starts below the status bar, so it has its own safe
 * area (SafeAreaProvider, measured natively; first guessed as the screen's
 * with no top), and the status bar turns light over the dimmed page above
 * it. useCloseWed() closes it from any Wed page; with nothing under it (Wed
 * opened by its address) that goes Home. The web has its own file.
 */
export function WedSheet({ children }: { children: ReactNode }) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const frame = useSafeAreaFrame();
  // Over a tab or a page, or the only screen (opened by its address)
  const [over] = useState(() => navigation.canGoBack());

  const close = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else router.replace('/');
  }, [navigation]);

  const content = <CloseWedProvider value={close}>{children}</CloseWedProvider>;
  if (Platform.OS !== 'ios') return content;

  return (
    <SafeAreaProvider
      style={styles.fill}
      initialMetrics={{ frame, insets: over ? { ...insets, top: 0 } : insets }}
    >
      <StatusBar style="light" />
      {content}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
