/**
 * A photo for each event, by event slug: beside it on Home's Plan by event,
 * and across the top of its guide (/e/[slug]). Display only, like
 * eventEmoji(): the events always come from the database, and one with no
 * photo here shows its emoji instead, so a new event needs no app change.
 * Free Pexels photos at 900 × 675 (credits in assets/images/events/README.md);
 * they live in the app because the database is frozen until the demo
 * (DECISIONS.md, 2026-10-20).
 */
export const EVENT_PHOTOS: Readonly<Record<string, number>> = {
  roka: require('../../../assets/images/events/roka.jpg'),
  'chunni-kurmai': require('../../../assets/images/events/chunni-kurmai.jpg'),
  sangeet: require('../../../assets/images/events/sangeet.jpg'),
  mehndi: require('../../../assets/images/events/mehndi.jpg'),
  maiyan: require('../../../assets/images/events/maiyan.jpg'),
  jaago: require('../../../assets/images/events/jaago.jpg'),
  baraat: require('../../../assets/images/events/baraat.jpg'),
  'sehra-ghori': require('../../../assets/images/events/baraat.jpg'),
  'anand-karaj': require('../../../assets/images/events/anand-karaj.jpg'),
  nikah: require('../../../assets/images/events/nikah.jpg'),
  // Pakistani weddings' Shadi / Baraat
  shadi: require('../../../assets/images/events/baraat.jpg'),
  pheras: require('../../../assets/images/events/pheras.jpg'),
  'church-wedding': require('../../../assets/images/events/church-wedding.jpg'),
  reception: require('../../../assets/images/events/reception.jpg'),
  walima: require('../../../assets/images/events/walima.jpg'),
};
