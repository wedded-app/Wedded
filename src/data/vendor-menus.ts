/**
 * Vendor menus (vendor_menus): packages and thalis with a price per person or
 * plate, minimum guests, cuisine, diet tags and sections of dishes. Families
 * see them on the vendor page, in Compare and in chat.
 */
import { useQuery } from '@tanstack/react-query';

import type { LocalizedText } from '@/i18n/localized';
import { supabase } from '@/lib/supabase';

export type DietTag =
  'veg' | 'non_veg' | 'jhatka' | 'halal' | 'jain' | 'eggless' | 'vegan' | 'gluten_free';

const DIET_TAGS: readonly string[] = [
  'veg',
  'non_veg',
  'jhatka',
  'halal',
  'jain',
  'eggless',
  'vegan',
  'gluten_free',
];

export type MenuItem = { name: LocalizedText; description: string | null; dietTags: DietTag[] };
export type MenuSection = { name: LocalizedText; items: MenuItem[] };

export type Menu = {
  id: string;
  name: LocalizedText;
  description: LocalizedText | null;
  price: { amount: number; unit: 'person' | 'plate' | 'event' } | null;
  minGuests: number | null;
  cuisine: string | null;
  dietTags: DietTag[];
  sections: MenuSection[];
};

function dietTags(value: unknown): DietTag[] {
  return Array.isArray(value)
    ? (value.filter((t) => typeof t === 'string' && DIET_TAGS.includes(t)) as DietTag[])
    : [];
}

function text(en: unknown): LocalizedText {
  return { en: typeof en === 'string' ? en : '' };
}

type Row = {
  id: string;
  name: string;
  description: string | null;
  cuisine: string | null;
  diet: string[];
  price_from: number | null;
  price_unit: string | null;
  min_guests: number | null;
  sections: unknown;
};

/** One database row as the Menu the screens use. */
export function toMenu(row: Row): Menu {
  const sections = Array.isArray(row.sections) ? row.sections : [];
  return {
    id: row.id,
    name: text(row.name),
    description: row.description ? text(row.description) : null,
    price:
      row.price_from &&
      (row.price_unit === 'person' || row.price_unit === 'plate' || row.price_unit === 'event')
        ? { amount: row.price_from, unit: row.price_unit }
        : null,
    minGuests: row.min_guests,
    cuisine: row.cuisine,
    dietTags: dietTags(row.diet),
    sections: sections.map((section: Record<string, unknown>) => ({
      name: text(section.title),
      items: (Array.isArray(section.items) ? section.items : []).map(
        (item: Record<string, unknown>) => ({
          name: text(item.name),
          description: typeof item.description === 'string' ? item.description : null,
          dietTags: dietTags(item.diet),
        }),
      ),
    })),
  };
}

/** The cheapest menu price, for "Menus from $28 / plate" (Compare, cards). */
export function cheapestMenu(menus: Menu[]): Menu['price'] {
  return menus.reduce<Menu['price']>(
    (best, menu) => (menu.price && (!best || menu.price.amount < best.amount) ? menu.price : best),
    null,
  );
}

export async function fetchVendorMenus(vendorId: string): Promise<Menu[]> {
  const { data, error } = await supabase
    .from('vendor_menus')
    .select('id, name, description, cuisine, diet, price_from, price_unit, min_guests, sections')
    .eq('vendor_id', vendorId)
    .order('sort_order')
    .order('created_at');
  if (error) throw error;
  return (data as Row[]).map(toMenu);
}

/** A vendor's menus in their order. Empty for vendors without menus. */
export function useVendorMenus(vendorId: string) {
  return useQuery({
    queryKey: ['vendor-menus', vendorId],
    queryFn: () => fetchVendorMenus(vendorId),
    enabled: vendorId.length > 0,
  });
}
