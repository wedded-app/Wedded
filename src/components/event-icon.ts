import type { IconName } from '@/components/icon';

// Display only: the events themselves come from the database. An event that
// isn't listed here (one added later) gets the calendar, so it never breaks a
// screen. No religious symbols as decoration (vision §4): ceremonies share
// the infinity sign.
const EVENT_ICONS: Partial<Record<string, IconName>> = {
  roka: 'gift-outline',
  'chunni-kurmai': 'diamond-outline',
  saha: 'mail-outline',
  'akhand-paath': 'flower-outline',
  sangeet: 'musical-notes-outline',
  mehndi: 'hand-left-outline',
  maiyan: 'sunny-outline',
  jaago: 'flame-outline',
  choora: 'sparkles-outline',
  'sehra-ghori': 'ribbon-outline',
  baraat: 'people-outline',
  milni: 'people-circle-outline',
  'anand-karaj': 'infinite-outline',
  pheras: 'infinite-outline',
  nikah: 'infinite-outline',
  'church-wedding': 'infinite-outline',
  langar: 'restaurant-outline',
  'viah-di-roti': 'restaurant-outline',
  walima: 'restaurant-outline',
  shadi: 'star-outline',
  zaffa: 'musical-notes-outline',
  doli: 'car-outline',
  reception: 'sparkles-outline',
  'pag-phera': 'home-outline',
  'whole-wedding': 'checkbox-outline',
};

/** The icon for an event slug. */
export function eventIcon(eventSlug: string): IconName {
  return EVENT_ICONS[eventSlug] ?? 'calendar-outline';
}
