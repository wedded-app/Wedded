import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseVendorFile } from './vendor-file';

const hall = {
  slug: 'sunrise-hall',
  status: 'published',
  name: '  Sunrise Hall ',
  city: 'Yuba City',
  address_visibility: 'public',
  address_line: '100 Example Road',
  latitude: 39.14,
  longitude: -121.61,
  call_phone: '(530) 555-0199',
  instagram_handle: 'https://instagram.com/sunrisehall/',
  price_display: 'starting_at',
  price_from: 45,
  price_unit: 'plate',
  details: { seated_capacity: 600, outside_catering: 'approved_list', curfew: '00:30' },
  categories: ['banquet-hall'],
  events: ['reception'],
  private: { email: ' Bookings@Example.com ', owner_name: 'Owner' },
  links: [{ vendor: 'saffron-tandoor-catering', kind: 'approved_caterer' }],
};

describe('parseVendorFile', () => {
  it('accepts the example file in docs', () => {
    const json = JSON.parse(
      readFileSync(join(__dirname, '../docs/examples/vendor.example.json'), 'utf8'),
    );
    const { vendors, errors, warnings } = parseVendorFile(json);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(vendors).toHaveLength(1);
  });

  it('cleans what people type', () => {
    const { vendors, errors } = parseVendorFile(hall);
    expect(errors).toEqual([]);
    const [vendor] = vendors;
    expect(vendor.row.name).toBe('Sunrise Hall');
    expect(vendor.row.call_phone).toBe('+15305550199');
    expect(vendor.row.instagram_handle).toBe('sunrisehall');
    expect(vendor.point).toEqual({ latitude: 39.14, longitude: -121.61 });
    expect(vendor.private?.email).toBe('bookings@example.com');
    expect(vendor.links).toEqual([{ vendor: 'saffron-tandoor-catering', kind: 'approved_caterer' }]);
  });

  it('keeps home-based vendors off the map', () => {
    const { errors } = parseVendorFile({
      ...hall,
      address_visibility: 'city_only',
      address_line: undefined,
    });
    expect(errors).toEqual([
      expect.stringContaining('latitude and longitude are a public map point'),
    ]);

    const { vendors } = parseVendorFile({
      ...hall,
      address_visibility: 'city_only',
      address_line: undefined,
      latitude: undefined,
      longitude: undefined,
    });
    expect(vendors[0].point).toBeNull();
  });

  it('refuses a street address that is not public', () => {
    const { errors } = parseVendorFile({ ...hall, address_visibility: 'on_request' });
    expect(errors.some((e) => e.includes('address_line is shown to everyone'))).toBe(true);
  });

  it('explains each problem in plain words', () => {
    const { vendors, errors } = parseVendorFile({
      slug: 'Sunrise Hall',
      name: '',
      city: 'Yuba City',
      call_phone: '555',
      price_display: 'range',
      price_from: 500,
      details: { curfew: '1 am' },
      categories: [],
    });
    expect(vendors).toEqual([]);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('slug must be lowercase words'),
        expect.stringContaining('name must be text'),
        expect.stringContaining('call_phone "555" is not a phone number'),
        expect.stringContaining('"range" prices need'),
        expect.stringContaining('details.curfew'),
        expect.stringContaining('categories must list 1 to 3'),
      ]),
    );
  });

  it('lets null clear an optional field', () => {
    const { vendors } = parseVendorFile({ ...hall, instagram_handle: null, tagline: null });
    expect(vendors[0].row.instagram_handle).toBeNull();
    expect(vendors[0].row.tagline).toBeNull();
  });

  it('warns about fields it does not know', () => {
    const { warnings, errors } = parseVendorFile({ ...hall, capacity: 600 });
    expect(errors).toEqual([]);
    expect(warnings).toEqual([expect.stringContaining('"capacity" is not a vendor field')]);
  });

  it('catches duplicates across the file', () => {
    const { errors } = parseVendorFile([
      { ...hall, founding_number: 1 },
      { ...hall, founding_number: 1 },
    ]);
    expect(errors).toEqual(
      expect.arrayContaining([
        'sunrise-hall: listed twice in the file.',
        'Two vendors in the file have the same founding_number.',
      ]),
    );
  });

  it('reads menus and explains mistakes in them', () => {
    const good = parseVendorFile({
      ...hall,
      menus: [
        {
          name: 'Gold',
          price_from: 45,
          price_unit: 'plate',
          sections: [{ title: 'Mains', items: [{ name: 'Dal' }] }],
        },
      ],
    });
    expect(good.errors).toEqual([]);
    expect(good.vendors[0].menus?.[0].name).toBe('Gold');

    const bad = parseVendorFile({
      ...hall,
      menus: [
        { price_from: 45 },
        { name: 'Silver', price_from: 30, diet: ['keto'], sections: [{ items: [] }] },
      ],
    });
    expect(bad.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('menus[1] needs a name'),
        expect.stringContaining('menus[2] with a price needs'),
        expect.stringContaining('menus[2].diet'),
        expect.stringContaining('menus[2].sections'),
      ]),
    );
  });

  it('leaves menus alone when the file has none', () => {
    expect(parseVendorFile(hall).vendors[0].menus).toBeNull();
  });
});
