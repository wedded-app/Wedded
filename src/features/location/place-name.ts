/**
 * The city in a saved search place, for "Browse vendors near Sacramento, CA"
 * (2026-11-08): just the city, without the area code an area pick saved
 * ("916 · Sacramento") or the ZIP a ZIP search saved ("Yuba City 95993").
 * Null for a ZIP with no listed city ("ZIP 95993"), which shows as it is.
 */
export function placeCity(label: string): string | null {
  const city = label
    .trim()
    .replace(/^\d{3}\s*·\s*/, '')
    .replace(/\s+\d{5}$/, '')
    .replace(/,\s*[A-Z]{2}$/, '')
    .trim();
  if (!city || /^ZIP\b/i.test(city)) return null;
  return city;
}

type Translate = (key: string, options?: Record<string, string | number>) => string;

/**
 * How a saved place reads: "Sacramento, CA". Every city in our list is in
 * California (Northern California only for now), so the state is the same.
 */
export function placeName(label: string, t: Translate): string {
  const city = placeCity(label);
  return city ? t('location.cityState', { city }) : label.trim();
}
