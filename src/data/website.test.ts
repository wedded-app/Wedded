import {
  applyEventDetails,
  applySiteChanges,
  httpsLink,
  siteProblem,
  toSiteResult,
  type SiteEvent,
  type SitePage,
} from './website';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('expo-file-system', () => ({ File: jest.fn() }));
jest.mock('expo-image-manipulator', () => ({ ImageManipulator: {}, SaveFormat: {} }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'uuid' }));

const pageJson = {
  slug: 'asha-ravi',
  title: 'Asha & Ravi',
  wedding_date: '2027-06-12',
  design: 'heirloom',
  palette: 'maroon',
  cover_path: 'w/p',
  welcome: null,
  story: 'We met at college.',
  family_title: null,
  family_lines: ['Gill family', 'Sandhu family'],
  guide_title: 'At the gurdwara',
  livestream_url: null,
  livestream_note: null,
  rsvp_by: '2027-05-01',
  sections: ['family', 'events', 'gifts', 'rsvp'],
  searchable: false,
  published_at: null,
  rsvp_link: 'abc',
  guest: { name: 'Sandhu family', party_size: 4, token: 'tok' },
  events: [
    {
      slug: 'mehndi',
      date: '2027-06-11',
      starts_at: '18:00:00',
      ends_at: null,
      place: 'At home',
      city: 'Yuba City',
      dress_code: 'Greens and pinks',
      dress_colors: ['#4E8A4B'],
      note: null,
      shown_publicly: false,
      rsvp: 'pending',
      coming: null,
    },
    { place: 'no slug' },
  ],
  tips: [{ title: 'Shoes off', body: null, link: null }, { title: '' }],
  hotels: [],
  faq: [{ title: 'Parking?', body: 'Behind the hall', link: null }],
  editor: { wedding_id: 'w', role: 'editor', can_edit: true, has_password: false },
};

describe('toSiteResult', () => {
  it('reads a page, dropping parts and rows it does not know', () => {
    const result = toSiteResult(pageJson);
    expect(result?.kind).toBe('page');
    if (result?.kind !== 'page') return;
    const { page } = result;
    expect(page.sections).toEqual(['family', 'events', 'rsvp']);
    expect(page.events).toHaveLength(1);
    expect(page.events[0]).toMatchObject({
      slug: 'mehndi',
      startsAt: '18:00:00',
      dressColors: ['#4E8A4B'],
      shownPublicly: false,
      rsvp: 'pending',
    });
    expect(page.tips).toEqual([{ title: 'Shoes off', body: null, link: null }]);
    expect(page.guest).toEqual({ name: 'Sandhu family', partySize: 4, token: 'tok' });
    expect(page.editor).toEqual({
      weddingId: 'w',
      role: 'editor',
      canEdit: true,
      hasPassword: false,
    });
  });

  it('reads a password box', () => {
    expect(
      toSiteResult({
        locked: 'wrong_password',
        title: 'Asha & Ravi',
        design: 'noor',
        palette: null,
      }),
    ).toEqual({
      kind: 'locked',
      lock: { locked: 'wrong_password', title: 'Asha & Ravi', design: 'noor', palette: null },
    });
  });

  it('is null for nothing', () => {
    expect(toSiteResult(null)).toBeNull();
    expect(toSiteResult([])).toBeNull();
  });
});

describe('applySiteChanges', () => {
  const result = toSiteResult(pageJson);
  const page = (result?.kind === 'page' ? result.page : null) as SitePage;

  it('changes only the keys given, trimming and clearing like the database', () => {
    const next = applySiteChanges(page, {
      design: '',
      story: '  ',
      family_lines: [' Gill family ', ''],
      sections: ['events'],
    });
    expect(next.design).toBe('classic');
    expect(next.story).toBeNull();
    expect(next.familyLines).toEqual(['Gill family']);
    expect(next.sections).toEqual(['events']);
    expect(next.palette).toBe('maroon');
    expect(next.guideTitle).toBe('At the gurdwara');
  });
});

describe('applyEventDetails', () => {
  const event: SiteEvent = {
    slug: 'mehndi',
    date: null,
    startsAt: null,
    endsAt: null,
    place: null,
    city: null,
    dressCode: null,
    dressColors: [],
    note: 'Old note',
    shownPublicly: true,
    rsvp: null,
    coming: null,
  };

  it('puts colours in capitals and keeps what was not changed', () => {
    expect(
      applyEventDetails(event, {
        dress_code: ' Wear green ',
        dress_colors: ['#4e8a4b'],
        shown_publicly: false,
      }),
    ).toEqual({
      ...event,
      dressCode: 'Wear green',
      dressColors: ['#4E8A4B'],
      shownPublicly: false,
    });
  });
});

describe('httpsLink', () => {
  it('adds https:// and upgrades http://', () => {
    expect(httpsLink(' marriott.com/book ')).toBe('https://marriott.com/book');
    expect(httpsLink('http://example.com')).toBe('https://example.com');
    expect(httpsLink('https://example.com')).toBe('https://example.com');
    expect(httpsLink('  ')).toBeNull();
  });
});

describe('siteProblem', () => {
  it('words what the database refused', () => {
    expect(siteProblem(new Error('slug_taken'))).toBe('slugTaken');
    expect(siteProblem(new Error('site_not_found'))).toBe('notFound');
    expect(siteProblem(new Error('password_limit'))).toBe('passwordLimit');
    expect(siteProblem(new Error('too_many_items'))).toBe('tooMany');
    expect(siteProblem(new Error('new row violates check constraint'))).toBe('invalid');
    expect(siteProblem(new Error('Network request failed'))).toBe('offline');
    expect(siteProblem(new Error('???'))).toBe('failed');
  });
});
