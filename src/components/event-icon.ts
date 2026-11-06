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

// The decoration each event's stop wears on Home's timeline (Fezy,
// 2026-11-05: rings for the Nikah). Display only, like the icons above, with
// the same rule: no religious symbols. Rings only where rings are exchanged;
// the Sikh and Hindu ceremonies get flowers.
const EVENT_EMOJI: Partial<Record<string, string>> = {
  roka: '🎁',
  'chunni-kurmai': '💍',
  saha: '✉️',
  'akhand-paath': '🌸',
  sangeet: '🎶',
  mehndi: '🌿',
  maiyan: '🌼',
  jaago: '🪔',
  choora: '💫',
  'sehra-ghori': '🐎',
  baraat: '🥁',
  milni: '🤝',
  'anand-karaj': '💐',
  pheras: '🌺',
  nikah: '💍',
  'church-wedding': '💍',
  langar: '🍲',
  'viah-di-roti': '🍛',
  walima: '🍽️',
  shadi: '✨',
  zaffa: '🎺',
  doli: '🚗',
  reception: '🥂',
  'pag-phera': '🏡',
  'whole-wedding': '🗓️',
};

/** The decoration for an event slug; one added later gets a sparkle. */
export function eventEmoji(eventSlug: string): string {
  return EVENT_EMOJI[eventSlug] ?? '✨';
}
