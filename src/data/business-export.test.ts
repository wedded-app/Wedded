import { csvCell, exportCsv, exportFileName, type BusinessExport } from './business-export';

jest.mock('@/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));
jest.mock('./business-export-file', () => ({ saveExportFile: jest.fn() }));

describe('csvCell', () => {
  it('quotes commas, quotes and line breaks', () => {
    expect(csvCell('Yuba City')).toBe('Yuba City');
    expect(csvCell('Dal, rice')).toBe('"Dal, rice"');
    expect(csvCell('She said "yes"')).toBe('"She said ""yes"""');
    expect(csvCell('Line one\nLine two')).toBe('"Line one\nLine two"');
  });

  it('never lets text from a family run as a formula', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+1 555')).toBe("'+1 555");
    expect(csvCell('@everyone')).toBe("'@everyone");
    expect(csvCell('-5')).toBe("'-5");
  });

  it('writes numbers as they are, yes/no for true/false, and blanks for nothing', () => {
    expect(csvCell(-5)).toBe('-5');
    expect(csvCell(true)).toBe('Yes');
    expect(csvCell(false)).toBe('No');
    expect(csvCell(null)).toBe('');
  });
});

const data: BusinessExport = {
  vendor: { name: 'Royal Orchard', slug: 'royal-orchard', city: 'Yuba City' },
  exportedOn: '2026-10-12',
  leads: [
    {
      createdAt: '2026-10-13T03:00:00Z',
      familyName: 'Harjit K.',
      events: ['Reception', 'Jaago'],
      eventDate: '2027-06-12',
      guestBand: '250_500',
      location: 'Yuba City',
      isTour: false,
      preferredContact: 'whatsapp',
      phone: '+15305550101',
      email: null,
      replied: true,
      message: 'Is June 12 open, for 300?',
    },
    {
      createdAt: '2026-10-01T18:00:00Z',
      familyName: null,
      events: [],
      eventDate: null,
      guestBand: 'not_sure',
      location: 'Marysville',
      isTour: true,
      preferredContact: 'email',
      phone: null,
      email: 'gill@example.com',
      replied: false,
      message: 'Can we visit?',
    },
  ],
  months: [
    {
      month: '2026-10',
      views: 120,
      contacts: 14,
      calls: 6,
      texts: 3,
      whatsapps: 5,
      saves: 9,
      inquiries: 2,
      reelViews: 800,
    },
  ],
  days: [{ day: '2027-06-12', part: 'all_day', status: 'booked' }],
  menus: [
    {
      name: 'Gold',
      cuisine: 'Punjabi',
      diet: ['veg', 'jhatka'],
      priceFrom: 45,
      priceUnit: 'plate',
      minGuests: 200,
      description: null,
      sections: [{ title: 'Mains', items: [{ name: 'Dal makhani' }, { name: 'Paneer' }] }],
    },
  ],
};

describe('exportCsv', () => {
  const csv = exportCsv(data);
  const lines = csv.replace('﻿', '').split('\r\n');

  it('starts with the byte-order mark so Excel reads it as UTF-8', () => {
    expect(csv.startsWith('﻿')).toBe(true);
  });

  it('writes each lead in plain words, on the California day it came in', () => {
    expect(lines).toContain(
      '2026-10-12,Harjit K.,Reception; Jaago,2027-06-12,250 to 500,Yuba City,No,WhatsApp,(530) 555-0101,,Yes,"Is June 12 open, for 300?"',
    );
    expect(lines).toContain(
      '2026-10-01,Deleted account,,Not sure yet,Not sure,Marysville,Yes,Email,,gill@example.com,No,Can we visit?',
    );
  });

  it('has the four parts with their counts', () => {
    expect(lines).toContain('Leads (2)');
    expect(lines).toContain('Numbers by month');
    expect(lines).toContain('2026-10,120,14,6,3,5,9,2,800');
    expect(lines).toContain('Booked and held days (1)');
    expect(lines).toContain('2027-06-12,All day,Booked');
    expect(lines).toContain('Menus (1)');
    expect(lines).toContain(
      'Gold,$45 per plate,200,Punjabi,"veg, jhatka",,"Mains: Dal makhani, Paneer"',
    );
  });
});

describe('exportFileName', () => {
  it('names the file after the business and the day', () => {
    expect(exportFileName(data)).toBe('royal-orchard-wedded-2026-10-12.csv');
  });
});
