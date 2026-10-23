import { router } from 'expo-router';
import { createContext, useContext } from 'react';

import { GlassButton } from '@/components/glass-button';
import { useColors } from '@/constants/theme';
import { useLocale } from '@/i18n/locale-context';

// Outside the sheet there's nothing to slide down: plain Back
const CloseWedContext = createContext<() => void>(() => router.back());

/** Given by WedSheet (wed-sheet.tsx) to everything in Wed's routes. */
export const CloseWedProvider = CloseWedContext.Provider;

/**
 * Closes Wed from any of its pages: the sheet slides down and leaves the tab
 * or page it opened over as it was.
 */
export function useCloseWed() {
  return useContext(CloseWedContext);
}

/**
 * The round chevron that closes Wed, for the right of a Wed page's nav bar
 * (NavScreen's `trailing`), so a page opened straight from Home closes in
 * one tap as well as by Back to the chat.
 */
export function WedCloseButton() {
  const Colors = useColors();
  const { t } = useLocale();
  const close = useCloseWed();
  return (
    <GlassButton
      icon="chevron-down"
      color={Colors.text}
      accessibilityLabel={t('wedSheet.close')}
      onPress={close}
    />
  );
}
