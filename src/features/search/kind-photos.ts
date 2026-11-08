/**
 * A photo for each kind of vendor's round button (Browse categories and All
 * categories), by category slug: display only, like groupIcon(). The kinds
 * themselves always come from the database, and one with no photo here shows
 * its group's icon instead, so a new kind needs no app change. The photos are
 * free Pexels photos (credits in assets/images/kinds/README.md); they live in
 * the app because the database is frozen until the demo (DECISIONS.md,
 * 2026-10-20) and the demo vendors' own photos are placeholders.
 */
export const KIND_PHOTOS: Readonly<Record<string, number>> = {
  'banquet-hall': require('../../../assets/images/kinds/banquet-hall.jpg'),
  'bar-service': require('../../../assets/images/kinds/bar-service.jpg'),
  'bridal-boutique': require('../../../assets/images/kinds/bridal-boutique.jpg'),
  'cake-desserts': require('../../../assets/images/kinds/cake-desserts.jpg'),
  'cars-limos': require('../../../assets/images/kinds/cars-limos.jpg'),
  caterer: require('../../../assets/images/kinds/caterer.jpg'),
  decorator: require('../../../assets/images/kinds/decorator.jpg'),
  dhol: require('../../../assets/images/kinds/dhol.jpg'),
  dj: require('../../../assets/images/kinds/dj.jpg'),
  favors: require('../../../assets/images/kinds/favors.jpg'),
  florist: require('../../../assets/images/kinds/florist.jpg'),
  ghori: require('../../../assets/images/kinds/ghori.jpg'),
  gurdwara: require('../../../assets/images/kinds/gurdwara.jpg'),
  halwai: require('../../../assets/images/kinds/halwai.jpg'),
  'hotel-ballroom': require('../../../assets/images/kinds/hotel-ballroom.jpg'),
  invitations: require('../../../assets/images/kinds/invitations.jpg'),
  'jaago-decor': require('../../../assets/images/kinds/jaago-decor.jpg'),
  jewelry: require('../../../assets/images/kinds/jewelry.jpg'),
  lighting: require('../../../assets/images/kinds/lighting.jpg'),
  'live-counters': require('../../../assets/images/kinds/live-counters.jpg'),
  'live-singer': require('../../../assets/images/kinds/live-singer.jpg'),
  makeup: require('../../../assets/images/kinds/makeup.jpg'),
  'mehndi-artist': require('../../../assets/images/kinds/mehndi-artist.jpg'),
  mithai: require('../../../assets/images/kinds/mithai.jpg'),
  'outdoor-venue': require('../../../assets/images/kinds/outdoor-venue.jpg'),
  photographer: require('../../../assets/images/kinds/photographer.jpg'),
  phulkari: require('../../../assets/images/kinds/phulkari.jpg'),
  planner: require('../../../assets/images/kinds/planner.jpg'),
  videographer: require('../../../assets/images/kinds/videographer.jpg'),
};
