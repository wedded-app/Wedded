import { Stack } from 'expo-router';

import { useColors } from '@/constants/theme';
import { WedSheet } from '@/features/wed/wed-sheet';

// The chat is the first screen of this stack, so a deep link to a Wed page
// (/wed/updates) still has the chat underneath it to go back to.
export const unstable_settings = {
  anchor: 'index',
  initialRouteName: 'index',
};

/**
 * Wed's stack, in a sheet that slides up over whatever tab or page it was
 * opened from (WedSheet; the root stack presents it as a modal): the chat,
 * then Wed's pages (Updates, Goals, Ideas, Lists and photos, Apps, How much
 * Wed does, What Wed knows) pushed on top inside the sheet. A plain `wed/`
 * folder, not a `(wed)` group, whose index would claim `/` from Home.
 * Screens draw their own Back button, and a chevron that closes the sheet.
 */
export default function WedStackLayout() {
  const Colors = useColors();
  return (
    <WedSheet>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.bg } }} />
    </WedSheet>
  );
}
