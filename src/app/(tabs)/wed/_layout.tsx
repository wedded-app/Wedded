import { Stack } from 'expo-router';

import { useColors } from '@/constants/theme';

// The chat is the first screen of this tab's stack, so a deep link to a Wed
// page (/wed/updates) still has the chat underneath it to go back to.
export const unstable_settings = {
  anchor: 'index',
  initialRouteName: 'index',
};

/**
 * The Wed tab's stack: the chat, then Wed's pages (Updates, Goals, Ideas,
 * Lists and photos, Apps, How much Wed does, What Wed knows) pushed on top
 * with the tab bar still showing. A plain `wed/` folder, not a `(wed)` group,
 * whose index would claim `/` from Home. Screens draw their own Back button.
 */
export default function WedStackLayout() {
  const Colors = useColors();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.bg } }} />
  );
}
