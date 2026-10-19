/**
 * Compare (vision idea 12): two or three vendors side by side. Pure: turns
 * profiles into rows of values, one per vendor, and leaves out rows where
 * nobody has anything to say, so halls compare on seats and catering and DJs
 * don't get a wall of blanks.
 */
import { cheapestMenu, type Menu } from '@/data/vendor-menus';
import type { VendorProfile } from '@/data/vendors';
import { localized } from '@/i18n/localized';

import { ALL_NORCAL_MILES, formatTime, priceLine, usd, type Translate } from './profile-format';

export type CompareRow = { key: string; label: string; values: (string | null)[] };

/** Extra per-vendor numbers from vendor_public_stats (null below 5). */
export type CompareStats = {
  savedBy: number | null;
  replied: { replied: number; answered: number } | null;
};

export const MAX_COMPARE = 3;

export function compareRows(
  vendors: VendorProfile[],
  t: Translate,
  stats: (CompareStats | undefined)[] = [],
  menus: (Menu[] | undefined)[] = [],
): CompareRow[] {
  const rows: CompareRow[] = [
    {
      key: 'price',
      label: t('compare.rows.price'),
      values: vendors.map((v) => (v.price ? priceLine(v.price, t) : null)),
    },
    {
      key: 'menus',
      label: t('compare.rows.menus'),
      values: vendors.map((_, i) => {
        const cheapest = cheapestMenu(menus[i] ?? []);
        return cheapest
          ? t('menus.fromPrice', {
              amount: `${usd.format(cheapest.amount)} / ${t(`vendorCard.units.${cheapest.unit}`)}`,
            })
          : null;
      }),
    },
    {
      key: 'seats',
      label: t('compare.rows.seats'),
      values: vendors.map((v) =>
        v.facts.seatedCapacity ? t('vendor.facts.seats', { count: v.facts.seatedCapacity }) : null,
      ),
    },
    {
      key: 'catering',
      label: t('compare.rows.catering'),
      values: vendors.map((v) =>
        v.facts.outsideCatering === 'yes'
          ? t('vendor.facts.outsideCateringYes')
          : v.facts.outsideCatering === 'approved_list'
            ? t('vendor.facts.outsideCateringList')
            : v.facts.outsideCatering === 'no'
              ? t('vendor.facts.outsideCateringNo')
              : null,
      ),
    },
    {
      key: 'alcohol',
      label: t('compare.rows.alcohol'),
      values: vendors.map((v) =>
        v.facts.alcoholPolicy === 'byob'
          ? v.facts.corkage
            ? t('vendor.facts.byobCorkage', { price: usd.format(v.facts.corkage) })
            : t('vendor.facts.byob')
          : v.facts.alcoholPolicy === 'full_bar'
            ? t('vendor.facts.fullBar')
            : v.facts.alcoholPolicy === 'none'
              ? t('vendor.facts.noAlcohol')
              : null,
      ),
    },
    {
      key: 'ghori',
      label: t('compare.rows.ghori'),
      values: vendors.map((v) =>
        v.facts.ghoriAllowed === true
          ? t('compare.yes')
          : v.facts.ghoriAllowed === false
            ? t('compare.no')
            : null,
      ),
    },
    {
      key: 'curfew',
      label: t('compare.rows.curfew'),
      values: vendors.map((v) => (v.facts.curfew ? formatTime(v.facts.curfew) : null)),
    },
    {
      key: 'parking',
      label: t('compare.rows.parking'),
      values: vendors.map((v) =>
        v.facts.parkingSpaces ? t('vendor.facts.parking', { count: v.facts.parkingSpaces }) : null,
      ),
    },
    {
      key: 'where',
      label: t('compare.rows.where'),
      values: vendors.map((v) =>
        v.addressLine
          ? v.city
          : v.serviceRadiusMiles >= ALL_NORCAL_MILES
            ? t('compare.travelsNorcal', { city: v.city })
            : t('compare.travels', { city: v.city, miles: v.serviceRadiusMiles }),
      ),
    },
    {
      key: 'languages',
      label: t('compare.rows.languages'),
      values: vendors.map((v) =>
        v.languages.length > 0 ? v.languages.map((name) => localized(name)).join(', ') : null,
      ),
    },
    {
      key: 'founding',
      label: t('compare.rows.founding'),
      values: vendors.map((v) =>
        v.foundingNumber ? t('vendor.foundingNumber', { number: v.foundingNumber }) : null,
      ),
    },
    {
      key: 'saved',
      label: t('compare.rows.saved'),
      values: vendors.map((_, i) =>
        stats[i]?.savedBy ? t('vendorStats.savedBy', { count: stats[i]!.savedBy! }) : null,
      ),
    },
    {
      key: 'replied',
      label: t('compare.rows.replied'),
      values: vendors.map((_, i) => {
        const r = stats[i]?.replied;
        return r ? t('compare.repliedShort', { replied: r.replied, answered: r.answered }) : null;
      }),
    },
  ];
  return rows.filter((row) => row.values.some((value) => value !== null));
}
