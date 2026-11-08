import { placeCity, placeName } from './place-name';

const t = (key: string, options?: Record<string, string | number>) =>
  key === 'location.cityState' ? `${options?.city}, CA` : key;

describe('placeCity', () => {
  it('keeps a plain city', () => {
    expect(placeCity('Sacramento')).toBe('Sacramento');
  });

  it('drops the area code an area pick saved', () => {
    expect(placeCity('916 · Sacramento')).toBe('Sacramento');
    expect(placeCity('510 · East Bay')).toBe('East Bay');
  });

  it('drops the ZIP a ZIP search saved', () => {
    expect(placeCity('Yuba City 95993')).toBe('Yuba City');
  });

  it('drops a state already on it', () => {
    expect(placeCity('Elk Grove, CA')).toBe('Elk Grove');
  });

  it('is null for a ZIP with no city', () => {
    expect(placeCity('ZIP 95993')).toBeNull();
    expect(placeCity('  ')).toBeNull();
  });
});

describe('placeName', () => {
  it('adds the state to the city', () => {
    expect(placeName('916 · Sacramento', t)).toBe('Sacramento, CA');
  });

  it('shows a ZIP with no city as it is', () => {
    expect(placeName('ZIP 95993', t)).toBe('ZIP 95993');
  });
});
