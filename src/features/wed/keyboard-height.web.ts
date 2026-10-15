import { useSharedValue, type SharedValue } from 'react-native-reanimated';

/**
 * Always 0 on the web: the browser resizes the page for a phone's keyboard,
 * and Reanimated can't watch it there (it warns if asked).
 */
export function useKeyboardHeight(): SharedValue<number> {
  return useSharedValue(0);
}
