import { Alert, Platform } from 'react-native';

/**
 * Asks first on phones (an alert) and on the web (the browser's confirm, as
 * Alert does nothing there). `style` is the yes button's: red for something
 * that removes or leaves, plain otherwise.
 */
export function confirm(
  title: string,
  body: string,
  yes: string,
  no: string,
  onYes: () => void,
  style: 'destructive' | 'default' = 'destructive',
) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm(`${title}\n\n${body}`)) onYes();
    return;
  }
  Alert.alert(title, body, [
    { text: no, style: 'cancel' },
    { text: yes, style, onPress: onYes },
  ]);
}
