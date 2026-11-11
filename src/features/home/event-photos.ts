/**
 * A photo for each event on Home's Plan by event, by event slug: display
 * only, like eventEmoji(). The events always come from the database, and one
 * with no photo here shows its emoji on a tile instead, so a new event needs
 * no app change. Most reuse the category photos (a Roka's sweets, a Baraat's
 * ghori); the rest are free Pexels photos (credits in
 * assets/images/events/README.md). They live in the app because the
 * database is frozen until the demo (DECISIONS.md, 2026-10-20).
 */
export const EVENT_PHOTOS: Readonly<Record<string, number>> = {
  roka: require('../../../assets/images/kinds/mithai.jpg'),
  'chunni-kurmai': require('../../../assets/images/kinds/jewelry.jpg'),
  sangeet: require('../../../assets/images/kinds/dhol.jpg'),
  mehndi: require('../../../assets/images/kinds/mehndi-artist.jpg'),
  maiyan: require('../../../assets/images/events/maiyan.jpg'),
  jaago: require('../../../assets/images/kinds/jaago-decor.jpg'),
  baraat: require('../../../assets/images/kinds/ghori.jpg'),
  'sehra-ghori': require('../../../assets/images/kinds/ghori.jpg'),
  'anand-karaj': require('../../../assets/images/kinds/gurdwara.jpg'),
  pheras: require('../../../assets/images/events/pheras.jpg'),
  'church-wedding': require('../../../assets/images/events/church-wedding.jpg'),
  reception: require('../../../assets/images/events/reception.jpg'),
  walima: require('../../../assets/images/kinds/banquet-hall.jpg'),
};
