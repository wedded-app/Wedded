/**
 * Vendor self-service (Town and Country feedback): a vendor's own people
 * (vendor_members) add, change and remove their menus and mark days booked,
 * held or open. The database checks membership; these hooks only shape the
 * writes and refresh what families see.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { DietTag, Menu } from '@/data/vendor-menus';
import { supabase } from '@/lib/supabase';

// Menus ----------------------------------------------------------------------------------------

export type MenuDraftItem = { name: string; description: string; dietTags: DietTag[] };
export type MenuDraftSection = { title: string; items: MenuDraftItem[] };

/** What the menu editor holds: plain strings, '' for blank. */
export type MenuDraft = {
  /** Set when changing a menu that exists. */
  id?: string;
  name: string;
  description: string;
  cuisine: string;
  dietTags: DietTag[];
  price: number | null;
  unit: 'person' | 'plate' | 'event';
  minGuests: number | null;
  sections: MenuDraftSection[];
};

export function emptyMenuDraft(): MenuDraft {
  return {
    name: '',
    description: '',
    cuisine: '',
    dietTags: [],
    price: null,
    unit: 'plate',
    minGuests: null,
    sections: [],
  };
}

/** A menu from useVendorMenus(), ready to edit. */
export function menuToDraft(menu: Menu): MenuDraft {
  return {
    id: menu.id,
    name: menu.name.en,
    description: menu.description?.en ?? '',
    cuisine: menu.cuisine ?? '',
    dietTags: menu.dietTags,
    price: menu.price?.amount ?? null,
    unit: menu.price?.unit ?? 'plate',
    minGuests: menu.minGuests,
    sections: menu.sections.map((section) => ({
      title: section.name.en,
      items: section.items.map((item) => ({
        name: item.name.en,
        description: item.description ?? '',
        dietTags: item.dietTags,
      })),
    })),
  };
}

export type MenuProblem = 'name' | 'price' | 'minGuests' | 'sectionTitle' | 'tooLong';

const LIMITS = { name: 80, description: 500, cuisine: 60, title: 60, item: 80, itemNote: 300 };

/**
 * Why the database would refuse this menu, or null. Blank items and sections
 * with nothing in them are dropped on save, so they're never a problem.
 */
export function menuProblem(draft: MenuDraft): MenuProblem | null {
  const row = menuRow(draft);
  if (!row.name) return 'name';
  if (row.price_from !== null && (!Number.isInteger(row.price_from) || row.price_from <= 0)) {
    return 'price';
  }
  if (row.min_guests !== null && (!Number.isInteger(row.min_guests) || row.min_guests <= 0)) {
    return 'minGuests';
  }
  if (row.sections.some((s) => !s.title)) return 'sectionTitle';
  if (
    row.name.length > LIMITS.name ||
    (row.description?.length ?? 0) > LIMITS.description ||
    (row.cuisine?.length ?? 0) > LIMITS.cuisine ||
    row.sections.length > 20 ||
    row.sections.some(
      (s) =>
        s.title.length > LIMITS.title ||
        s.items.length > 60 ||
        s.items.some(
          (i) => i.name.length > LIMITS.item || (i.description?.length ?? 0) > LIMITS.itemNote,
        ),
    )
  ) {
    return 'tooLong';
  }
  return null;
}

/** The vendor_menus columns for a draft: trimmed, blanks as null, empty rows dropped. */
export function menuRow(draft: MenuDraft) {
  const orNull = (value: string) => value.trim() || null;
  const sections = draft.sections
    .map((section) => ({
      title: section.title.trim(),
      items: section.items
        .filter((item) => item.name.trim())
        .map((item) => ({
          name: item.name.trim(),
          ...(item.description.trim() ? { description: item.description.trim() } : {}),
          ...(item.dietTags.length ? { diet: item.dietTags } : {}),
        })),
    }))
    .filter((section) => section.title || section.items.length > 0);
  return {
    name: draft.name.trim(),
    description: orNull(draft.description),
    cuisine: orNull(draft.cuisine),
    diet: draft.dietTags,
    price_from: draft.price,
    price_unit: draft.price === null ? null : draft.unit,
    min_guests: draft.minGuests,
    sections,
  };
}

/** Adds a menu (no id) or changes one (id). Returns the menu's id. */
export function useSaveMenu(vendorId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (draft: MenuDraft): Promise<string> => {
      const row = menuRow(draft);
      if (draft.id) {
        const { error } = await supabase.from('vendor_menus').update(row).eq('id', draft.id);
        if (error) throw error;
        return draft.id;
      }
      const { data, error } = await supabase
        .from('vendor_menus')
        .insert({ ...row, vendor_id: vendorId })
        .select('id')
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendor-menus', vendorId] }),
  });
}

export function useDeleteMenu(vendorId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (menuId: string) => {
      const { error } = await supabase.from('vendor_menus').delete().eq('id', menuId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendor-menus', vendorId] }),
  });
}

// Calendar -------------------------------------------------------------------------------------

export type DayPart = 'all_day' | 'morning' | 'evening';
export type DayMark = { part: DayPart; status: 'booked' | 'held' };
/** yyyy-mm-dd → that day's marks. Days not in the map are open. */
export type MonthMarks = Record<string, DayMark[]>;

/** The first and last yyyy-mm-dd of a yyyy-mm month. */
export function monthRange(month: string): { from: string; to: string } {
  const [year, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

export function groupMarks(rows: { day: string; part: string; status: string }[]): MonthMarks {
  const marks: MonthMarks = {};
  for (const row of rows) {
    const part = row.part as DayPart;
    const status = row.status === 'held' ? 'held' : 'booked';
    (marks[row.day] ??= []).push({ part, status });
  }
  return marks;
}

const calendarKey = (vendorId: string, month: string) => ['vendor-calendar', vendorId, month];

/** A vendor's marked days in a yyyy-mm month, for their own calendar screen. */
export function useVendorCalendar(vendorId: string, month: string) {
  return useQuery({
    queryKey: calendarKey(vendorId, month),
    queryFn: async (): Promise<MonthMarks> => {
      const { from, to } = monthRange(month);
      const { data, error } = await supabase
        .from('vendor_days')
        .select('day, part, status')
        .eq('vendor_id', vendorId)
        .neq('status', 'open')
        .gte('day', from)
        .lte('day', to);
      if (error) throw error;
      return groupMarks(data);
    },
    enabled: vendorId.length > 0 && /^\d{4}-\d{2}$/.test(month),
  });
}

export type DayChange = {
  /** yyyy-mm-dd */
  day: string;
  status: 'open' | 'booked' | 'held';
  /** Default all_day, which replaces any morning or evening marks. */
  part?: DayPart;
};

/**
 * Marks a day. All day replaces the day's marks; morning or evening replaces
 * that part and any all-day mark. Open clears them.
 */
export function useSetDayStatus(vendorId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ day, status, part = 'all_day' }: DayChange) => {
      let clear = supabase.from('vendor_days').delete().eq('vendor_id', vendorId).eq('day', day);
      if (part !== 'all_day') clear = clear.in('part', [part, 'all_day']);
      const { error: clearError } = await clear;
      if (clearError) throw clearError;
      if (status === 'open') return;
      const { error } = await supabase
        .from('vendor_days')
        .insert({ vendor_id: vendorId, day, part, status });
      if (error) throw error;
    },
    onSuccess: (_, { day }) => {
      queryClient.invalidateQueries({ queryKey: calendarKey(vendorId, day.slice(0, 7)) });
      queryClient.invalidateQueries({ queryKey: ['vendor-date-status', vendorId] });
    },
  });
}

/** "My calendar is up to date": unmarked days count as open for 60 days. */
export function useTouchCalendar(vendorId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('touch_vendor_calendar', { p_vendor_id: vendorId });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendor-date-status', vendorId] }),
  });
}
