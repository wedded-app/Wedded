/**
 * "Export everything" for My business (C6, #146): all of a vendor's data on
 * Wedded as one spreadsheet (CSV, which Excel, Google Sheets and Numbers open)
 * in four parts: leads, numbers by month, booked and held days, and menus. In
 * English, the language a business's own spreadsheets are usually kept in.
 */
import { useMutation } from '@tanstack/react-query';

import { formatPhone } from '@/lib/phone';
import { supabase } from '@/lib/supabase';

import { saveExportFile } from './business-export-file';

export type BusinessExport = {
  vendor: { name: string; slug: string; city: string | null } | null;
  /** yyyy-mm-dd, California */
  exportedOn: string;
  leads: {
    createdAt: string;
    familyName: string | null;
    events: string[];
    eventDate: string | null;
    guestBand: string;
    location: string;
    isTour: boolean;
    preferredContact: string;
    phone: string | null;
    email: string | null;
    replied: boolean;
    message: string;
  }[];
  months: {
    month: string;
    views: number;
    contacts: number;
    calls: number;
    texts: number;
    whatsapps: number;
    saves: number;
    inquiries: number;
    reelViews: number;
  }[];
  days: { day: string; part: string; status: string }[];
  menus: {
    name: string;
    cuisine: string | null;
    diet: string[];
    priceFrom: number | null;
    priceUnit: string | null;
    minGuests: number | null;
    description: string | null;
    sections: { title: string; items: { name: string }[] }[];
  }[];
};

export async function fetchBusinessExport(vendorId: string): Promise<BusinessExport> {
  const { data, error } = await supabase.rpc('business_export', { p_vendor_id: vendorId });
  if (error) throw error;
  return data as unknown as BusinessExport;
}

// CSV ---------------------------------------------------------------------------------------

type Cell = string | number | boolean | null | undefined;

/**
 * One spreadsheet cell: quoted when it holds a comma, quote or line break, and
 * never read as a formula (text from families starting with = + - or @ gets a
 * leading apostrophe, so a message can't run anything in Excel).
 */
export function csvCell(value: Cell): string {
  if (value === null || value === undefined) return '';
  let text = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvRow(cells: Cell[]): string {
  return cells.map(csvCell).join(',');
}

const GUESTS: Record<string, string> = {
  under_50: 'Under 50',
  '50_100': '50 to 100',
  '100_250': '100 to 250',
  '250_500': '250 to 500',
  '500_plus': '500+',
  not_sure: 'Not sure',
};
const PARTS: Record<string, string> = {
  all_day: 'All day',
  morning: 'Morning',
  evening: 'Evening',
};
const UNITS: Record<string, string> = {
  person: 'per person',
  plate: 'per plate',
  event: 'per event',
};
const CONTACTS: Record<string, string> = {
  call: 'Call',
  text: 'Text',
  whatsapp: 'WhatsApp',
  email: 'Email',
};

const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/** The yyyy-mm-dd California day a time falls on. */
function californiaDay(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

/** The whole export as one CSV, a titled part after another with a blank line between. */
export function exportCsv(data: BusinessExport): string {
  const lines: string[] = [];
  lines.push(
    csvRow([`${data.vendor?.name ?? 'My business'} on Wedded`, `Exported ${data.exportedOn}`]),
  );

  lines.push('', csvRow([`Leads (${data.leads.length})`]));
  lines.push(
    csvRow([
      'Received',
      'Family',
      'Events',
      'Wedding date',
      'Guests',
      'Where',
      'Tour',
      'Prefers',
      'Phone',
      'Email',
      'You replied in chat',
      'Message',
    ]),
  );
  for (const lead of data.leads) {
    lines.push(
      csvRow([
        californiaDay(lead.createdAt),
        lead.familyName ?? 'Deleted account',
        lead.events.join('; '),
        lead.eventDate ?? 'Not sure yet',
        GUESTS[lead.guestBand] ?? lead.guestBand,
        lead.location,
        lead.isTour,
        CONTACTS[lead.preferredContact] ?? lead.preferredContact,
        lead.phone ? formatPhone(lead.phone) : '',
        lead.email,
        lead.replied,
        lead.message,
      ]),
    );
  }

  lines.push('', csvRow(['Numbers by month']));
  lines.push(
    csvRow([
      'Month',
      'Page views',
      'Contact taps',
      'Calls',
      'Texts',
      'WhatsApps',
      'Saves',
      'Inquiries',
      'Reel views',
    ]),
  );
  for (const m of data.months) {
    lines.push(
      csvRow([
        m.month,
        m.views,
        m.contacts,
        m.calls,
        m.texts,
        m.whatsapps,
        m.saves,
        m.inquiries,
        m.reelViews,
      ]),
    );
  }

  lines.push('', csvRow([`Booked and held days (${data.days.length})`]));
  lines.push(csvRow(['Day', 'Part', 'Status']));
  for (const d of data.days) {
    lines.push(csvRow([d.day, PARTS[d.part] ?? d.part, capitalize(d.status)]));
  }

  lines.push('', csvRow([`Menus (${data.menus.length})`]));
  lines.push(
    csvRow(['Menu', 'Price', 'Minimum guests', 'Cuisine', 'Diet', 'Description', 'Dishes']),
  );
  for (const menu of data.menus) {
    const price =
      menu.priceFrom !== null
        ? `$${menu.priceFrom} ${UNITS[menu.priceUnit ?? ''] ?? ''}`.trim()
        : 'Contact for price';
    const dishes = menu.sections
      .map((s) => `${s.title}: ${s.items.map((i) => i.name).join(', ')}`)
      .join(' | ');
    lines.push(
      csvRow([
        menu.name,
        price,
        menu.minGuests,
        menu.cuisine,
        menu.diet.join(', '),
        menu.description,
        dishes,
      ]),
    );
  }

  // Excel needs the byte-order mark to read Gurmukhi and other scripts as UTF-8
  return `﻿${lines.join('\r\n')}\r\n`;
}

/** "royal-orchard-wedded-2026-10-12.csv" */
export function exportFileName(data: BusinessExport): string {
  return `${data.vendor?.slug ?? 'my-business'}-wedded-${data.exportedOn}.csv`;
}

/**
 * Fetch everything, build the spreadsheet and hand it to the phone's share
 * sheet (save to Files, email it, AirDrop…), or download it on the web.
 */
export function useExportBusiness(vendorId: string) {
  return useMutation({
    mutationFn: async () => {
      const data = await fetchBusinessExport(vendorId);
      await saveExportFile(exportFileName(data), exportCsv(data));
    },
  });
}
