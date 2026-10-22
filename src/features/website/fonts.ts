import { Cinzel_500Medium } from '@expo-google-fonts/cinzel';
import {
  CormorantGaramond_500Medium,
  CormorantGaramond_600SemiBold,
} from '@expo-google-fonts/cormorant-garamond';
import { PinyonScript_400Regular } from '@expo-google-fonts/pinyon-script';
import { useFonts } from 'expo-font';

/**
 * The website designs' own fonts, loaded at runtime (Expo Go) the first time
 * a site or the builder opens, not with the app's start-up fonts. Fraunces
 * and Plus Jakarta Sans are already loaded. True once they're ready or failed
 * (the page then draws in the app's fonts rather than waiting forever).
 */
export function useSiteFonts(): boolean {
  const [loaded, error] = useFonts({
    Cinzel_500Medium,
    CormorantGaramond_500Medium,
    CormorantGaramond_600SemiBold,
    PinyonScript_400Regular,
  });
  return loaded || !!error;
}
