/**
 * Formatting for the vendor profile (vision doc S9): the price line, hall
 * fact chips and times. Pure functions: pass the app's translate function in.
 */
import type { HallFacts, VendorPrice } from '@/data/vendors';

export type Translate = (key: string, options?: Record<string, string | number>) => string;

// Prices keep Latin digits in both languages (vision doc section 4).
export const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

// service_radius_miles uses 250 for "all of Northern California".
export const ALL_NORCAL_MILES = 250;

export function priceLine(price: VendorPrice, t: Translate): string {
  switch (price.kind) {
    case 'starting_at':
      return price.unit
        ? t('vendorCard.fromPer', {
            price: usd.format(price.amount),
            unit: t(`vendorCard.units.${price.unit}`),
          })
        : t('vendorCard.from', { price: usd.format(price.amount) });
    case 'range':
      return price.unit
        ? t('vendor.priceRangePer', {
            from: usd.format(price.from),
            to: usd.format(price.to),
            unit: t(`vendorCard.units.${price.unit}`),
          })
        : t('vendor.priceRange', { from: usd.format(price.from), to: usd.format(price.to) });
    case 'packages':
      return t('vendor.pricePackages');
    case 'contact':
      return t('vendor.priceContact');
  }
}

/** "01:00" → "1:00 AM", keeping Latin digits. */
export function formatTime(hhmm: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!match) return hhmm;
  const hours = Number(match[1]);
  const suffix = hours < 12 ? 'AM' : 'PM';
  return `${hours % 12 === 0 ? 12 : hours % 12}:${match[2]} ${suffix}`;
}

/** Hall fact chips (vision doc S9 item 9); a value the app doesn't know is skipped. */
export function factLabels(facts: HallFacts, t: Translate): string[] {
  const labels: string[] = [];
  if (facts.seatedCapacity) labels.push(t('vendor.facts.seats', { count: facts.seatedCapacity }));
  if (facts.outsideCatering === 'yes') labels.push(t('vendor.facts.outsideCateringYes'));
  if (facts.outsideCatering === 'approved_list') {
    labels.push(t('vendor.facts.outsideCateringList'));
  }
  if (facts.outsideCatering === 'no') labels.push(t('vendor.facts.outsideCateringNo'));
  if (facts.alcoholPolicy === 'byob') {
    labels.push(
      facts.corkage
        ? t('vendor.facts.byobCorkage', { price: usd.format(facts.corkage) })
        : t('vendor.facts.byob'),
    );
  }
  if (facts.alcoholPolicy === 'full_bar') labels.push(t('vendor.facts.fullBar'));
  if (facts.alcoholPolicy === 'dry') labels.push(t('vendor.facts.noAlcohol'));
  if (facts.ghoriAllowed === true) labels.push(t('vendor.facts.ghoriYes'));
  if (facts.ghoriAllowed === false) labels.push(t('vendor.facts.ghoriNo'));
  if (facts.curfew) labels.push(t('vendor.facts.curfew', { time: formatTime(facts.curfew) }));
  if (facts.parkingSpaces) {
    labels.push(t('vendor.facts.parking', { count: facts.parkingSpaces }));
  }
  return labels;
}
