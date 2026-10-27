import type { SiteEvent, SitePage } from '@/data/website';

import { matchSiteAsk, undoActions, wordActions } from './site-wed';

const event = (slug: string, dressCode: string | null = null): SiteEvent => ({
  slug,
  date: '2027-06-11',
  startsAt: null,
  endsAt: null,
  place: 'At home',
  city: null,
  dressCode,
  dressColors: [],
  note: null,
  shownPublicly: true,
  rsvp: null,
  coming: null,
});

const page = (over: Partial<SitePage> = {}): SitePage => ({
  slug: 'asha-ravi',
  title: 'Asha & Ravi',
  weddingDate: null,
  design: 'classic',
  palette: null,
  coverPath: null,
  welcome: null,
  story: null,
  familyTitle: null,
  familyLines: [],
  guideTitle: null,
  livestreamUrl: null,
  livestreamNote: null,
  rsvpBy: null,
  sections: ['events', 'rsvp'],
  searchable: false,
  publishedAt: null,
  rsvpLink: 'abc',
  guest: null,
  events: [event('mehndi'), event('anand-karaj'), event('reception', 'Black tie')],
  tips: [],
  hotels: [],
  faq: [],
  editor: null,
  ...over,
});

const tips = ['Please cover your head.', 'Shoes come off before you go in.'];

describe('matchSiteAsk', () => {
  it('turns colours into a new look, seen first', () => {
    const reply = matchSiteAsk('Make it maroon and gold', page(), tips);
    expect(reply.kind).toBe('proposal');
    if (reply.kind !== 'proposal') return;
    expect(reply.proposal.look).toEqual({ design: 'heirloom', palette: 'maroon' });
    expect(reply.proposal.actions).toEqual([
      { kind: 'update', changes: { design: 'heirloom', palette: 'maroon' } },
    ]);
  });

  it('matches whole words, so "covered" is not red', () => {
    expect(matchSiteAsk('I want it covered in flowers', page(), tips).kind).toBe('help');
  });

  it('suggests what to wear only for events without it', () => {
    const reply = matchSiteAsk('What should people wear?', page(), tips);
    if (reply.kind !== 'proposal') throw new Error(reply.kind);
    expect(reply.proposal.actions.map((a) => (a.kind === 'event' ? a.eventSlug : a.kind))).toEqual([
      'mehndi',
      'anand-karaj',
    ]);
  });

  it('adds the gurdwara guide and switches the part on', () => {
    const reply = matchSiteAsk('Add the gurdwara guide', page(), tips);
    if (reply.kind !== 'proposal') throw new Error(reply.kind);
    expect(reply.proposal.actions[0]).toEqual({
      kind: 'items',
      list: 'tip',
      items: tips.map((title) => ({ title, body: null, link: null })),
    });
    expect(reply.proposal.actions[1]).toEqual({
      kind: 'update',
      changes: { guide_title: 'website.wed.guide.gurdwara', sections: ['events', 'rsvp', 'guide'] },
    });
  });

  it('keeps a guide heading the site already has', () => {
    const p = page({ guideTitle: 'Our gurdwara visit' });
    const reply = matchSiteAsk('Add the gurdwara guide', p, tips);
    if (reply.kind !== 'proposal') throw new Error(reply.kind);
    expect(reply.proposal.lines[0].options?.title).toBe('Our gurdwara visit');
    // Like i18n-js: text that isn't a key comes back as a missing translation
    const t = (key: string) =>
      key.startsWith('website.') ? `${key}!` : `[missing "en.${key}" translation]`;
    expect(wordActions(reply.proposal.actions, t, p.title)[1]).toEqual({
      kind: 'update',
      changes: { sections: ['events', 'rsvp', 'guide'] },
    });
  });

  it('opens the photo sheet for a cover photo, not the guide', () => {
    expect(matchSiteAsk('Change the cover photo', page(), tips)).toMatchObject({
      kind: 'open',
      href: '/website/cover',
    });
  });

  it('lists what is missing', () => {
    const reply = matchSiteAsk('Is anything missing?', page(), tips);
    expect(reply.kind).toBe('missing');
  });

  it('says so when there is nothing to change', () => {
    expect(matchSiteAsk('make it simple', page({ palette: 'ink' }), tips)).toEqual({
      kind: 'nothing',
      sayKey: 'website.wed.say.sameLook',
    });
  });
});

describe('wordActions and undoActions', () => {
  it('fills in the words, and undo puts back what was there', () => {
    const p = page({ welcome: null, guideTitle: null });
    const reply = matchSiteAsk('set it up for me', p, tips);
    if (reply.kind !== 'proposal') throw new Error(reply.kind);
    const t = (key: string, o?: Record<string, string | number>) =>
      `${key}${o?.names ? `:${o.names}` : ''}`;
    const worded = wordActions(reply.proposal.actions, t, p.title);
    expect(worded[0]).toEqual({
      kind: 'update',
      changes: { welcome: 'website.wed.welcomeDraft:Asha & Ravi' },
    });
    const undo = undoActions(worded, p);
    expect(undo[0]).toEqual({ kind: 'update', changes: { welcome: null } });
    expect(undo.find((a) => a.kind === 'event')).toEqual({
      kind: 'event',
      eventSlug: 'mehndi',
      details: { dress_code: null, dress_colors: [] },
    });
  });
});
