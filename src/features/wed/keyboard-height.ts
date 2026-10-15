import { useAnimatedKeyboard, type SharedValue } from 'react-native-reanimated';

/**
 * The software keyboard's height on the UI thread, for lifting something that
 * floats at the bottom of the screen (Wed's composer) as it opens. The web
 * has its own file: browsers resize the page for the keyboard themselves.
 */
export function useKeyboardHeight(): SharedValue<number> {
  return useAnimatedKeyboard().height;
}
