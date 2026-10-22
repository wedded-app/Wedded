/**
 * Wed in the website builder. Like the rest of Wed until its brain (#124)
 * is in, it's scripted: what the family types is matched to a few things Wed
 * knows how to do to a site, and each becomes a proposal the family sees
 * first and applies with a tap (nothing changes until then), with Undo.
 * Plain logic, tested in site-wed.test.ts.
 */
import type {
  EventSiteDetails,
  SiteChanges,
  SiteItem,
  SiteListKind,
  SitePage,
} from '@/data/website';

import { missingParts, type MissingPart } from './site-helpers';

export type SiteAction =
  | { kind: 'update'; changes: SiteChanges }
  | { kind: 'items'; list: SiteListKind; items: SiteItem[] }
  | { kind: 'event'; eventSlug: string; details: EventSiteDetails }
  | { kind: 'publish' }
  | { kind: 'unpublish' };

/** One line of what will change, worded by the screen. */
export type ChangeLine = { key: string; options?: Record<string, string | number> };

export type SiteProposal = {
  /** What Wed says above the card (an i18n key). */
  sayKey: string;
  lines: ChangeLine[];
  actions: SiteAction[];
  /** For a new look: the cover before and after. */
  look?: { design: string; palette: string };
};

export type WedReply =
  | { kind: 'proposal'; proposal: SiteProposal }
  | { kind: 'missing'; parts: MissingPart[] }
  | { kind: 'open'; sayKey: string; href: string; buttonKey: string }
  | { kind: 'nothing'; sayKey: string }
  | { kind: 'help' };

/** Words that ask for a look, and the design and colours they mean. */
const LOOKS: { words: string[]; design: string; palette: string; nameKey: string }[] = [
  {
    words: ['simple', 'simpler', 'clean', 'minimal', 'modern', 'black and white', 'white'],
    design: 'classic',
    palette: 'ink',
    nameKey: 'website.wed.looks.classic',
  },
  {
    words: ['blush', 'soft pink', 'pastel'],
    design: 'classic',
    palette: 'blush',
    nameKey: 'website.wed.looks.blush',
  },
  {
    words: ['maroon', 'red', 'royal', 'gold', 'traditional', 'phulkari', 'embroider'],
    design: 'heirloom',
    palette: 'maroon',
    nameKey: 'website.wed.looks.maroon',
  },
  {
    words: ['emerald', 'green'],
    design: 'palace',
    palette: 'emerald',
    nameKey: 'website.wed.looks.emerald',
  },
  {
    words: ['arch', 'palace', 'mughal', 'ivory', 'elegant'],
    design: 'palace',
    palette: 'ivory',
    nameKey: 'website.wed.looks.palace',
  },
  {
    words: ['yellow', 'marigold', 'orange', 'haldi', 'bright', 'colourful', 'colorful'],
    design: 'marigold',
    palette: 'marigold',
    nameKey: 'website.wed.looks.marigold',
  },
  {
    words: ['navy', 'blue', 'night', 'midnight', 'dark', 'stars'],
    design: 'noor',
    palette: 'midnight',
    nameKey: 'website.wed.looks.noor',
  },
  { words: ['purple', 'plum'], design: 'noor', palette: 'plum', nameKey: 'website.wed.looks.plum' },
  {
    words: ['henna', 'mehndi', 'mehendi'],
    design: 'mehndi',
    palette: 'henna',
    nameKey: 'website.wed.looks.mehndi',
  },
  { words: ['pink', 'rose'], design: 'mehndi', palette: 'rose', nameKey: 'website.wed.looks.rose' },
];

/** What guests usually wear to each event, as a suggestion (i18n key and swatches). */
export const DRESS_IDEAS: Record<string, { key: string; colors: string[] }> = {
  haldi: { key: 'website.wed.dress.haldi', colors: ['#F2C230'] },
  mehndi: { key: 'website.wed.dress.mehndi', colors: ['#4E8A4B', '#E46C9A'] },
  sangeet: { key: 'website.wed.dress.sangeet', colors: ['#E46C9A', '#F08A00', '#7B3FA0'] },
  jaago: { key: 'website.wed.dress.jaago', colors: ['#F2C230', '#E46C9A'] },
  'anand-karaj': { key: 'website.wed.dress.anandKaraj', colors: [] },
  nikah: { key: 'website.wed.dress.nikah', colors: [] },
  pheras: { key: 'website.wed.dress.pheras', colors: ['#C4271B', '#F2C230'] },
  shadi: { key: 'website.wed.dress.shadi', colors: ['#8A1C30', '#D9B26A'] },
  walima: { key: 'website.wed.dress.walima', colors: ['#F4EDE1', '#D9B26A'] },
  reception: { key: 'website.wed.dress.reception', colors: ['#1F3B6E', '#0E5C4A', '#8A1C30'] },
  'church-wedding': { key: 'website.wed.dress.church', colors: [] },
};

/** The guide's heading for the ceremony in the plan. */
export function guideTitleKey(eventSlugs: string[]): string {
  if (eventSlugs.includes('anand-karaj') || eventSlugs.includes('akhand-paath')) {
    return 'website.wed.guide.gurdwara';
  }
  if (eventSlugs.includes('nikah')) return 'website.wed.guide.nikah';
  if (eventSlugs.includes('pheras')) return 'website.wed.guide.pheras';
  if (eventSlugs.includes('church-wedding')) return 'website.wed.guide.church';
  return 'website.site.goodToKnow';
}

type Translate = (key: string, options?: Record<string, string | number>) => string;

/** Whole words only, so "red" doesn't match "covered". */
const has = (text: string, words: string[]) =>
  words.some((w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text));

/** A new look for the site. */
export function lookProposal(
  page: SitePage,
  design: string,
  palette: string,
  nameKey: string,
): SiteProposal | null {
  if (page.design === design && (page.palette ?? '') === palette) return null;
  return {
    sayKey: 'website.wed.say.look',
    lines: [{ key: 'website.wed.lines.look', options: { look: nameKey } }],
    actions: [{ kind: 'update', changes: { design, palette } }],
    look: { design, palette },
  };
}

/** What to wear for each event that doesn't say yet. */
export function dressProposal(page: SitePage): SiteProposal | null {
  const actions: SiteAction[] = [];
  const lines: ChangeLine[] = [];
  for (const e of page.events) {
    const idea = DRESS_IDEAS[e.slug];
    if (e.dressCode || !idea) continue;
    actions.push({
      kind: 'event',
      eventSlug: e.slug,
      details: { dress_code: idea.key, dress_colors: idea.colors },
    });
    lines.push({ key: 'website.wed.lines.dress', options: { event: e.slug, idea: idea.key } });
  }
  return actions.length > 0 ? { sayKey: 'website.wed.say.dress', lines, actions } : null;
}

/** The guide for the ceremonies in the plan, from the suggested tips. */
export function guideProposal(page: SitePage, tips: string[]): SiteProposal | null {
  const have = new Set(page.tips.map((t) => t.title));
  const fresh = tips.filter((t) => !have.has(t));
  if (fresh.length === 0) return null;
  const items = [...page.tips, ...fresh.map((title) => ({ title, body: null, link: null }))].slice(
    0,
    12,
  );
  const titleKey = guideTitleKey(page.events.map((e) => e.slug));
  return {
    sayKey: 'website.wed.say.guide',
    lines: [
      {
        key: 'website.wed.lines.guide',
        options: { count: items.length - page.tips.length, title: titleKey },
      },
    ],
    actions: [
      { kind: 'items', list: 'tip', items },
      {
        kind: 'update',
        changes: {
          guide_title: page.guideTitle ?? titleKey,
          sections: page.sections.includes('guide') ? page.sections : [...page.sections, 'guide'],
        },
      },
    ],
  };
}

/** A warm welcome line under the names. */
export function welcomeProposal(page: SitePage): SiteProposal | null {
  if (page.welcome) return null;
  return {
    sayKey: 'website.wed.say.welcome',
    lines: [{ key: 'website.wed.lines.welcome' }],
    actions: [{ kind: 'update', changes: { welcome: 'website.wed.welcomeDraft' } }],
  };
}

/** Everything Wed can fill in at once. */
export function setUpProposal(page: SitePage, tips: string[]): SiteProposal | null {
  const parts = [welcomeProposal(page), dressProposal(page), guideProposal(page, tips)].filter(
    (p): p is SiteProposal => p !== null,
  );
  if (parts.length === 0) return null;
  return {
    sayKey: 'website.wed.say.setUp',
    lines: parts.flatMap((p) => p.lines),
    actions: parts.flatMap((p) => p.actions),
  };
}

/** Match what the family typed to something Wed can do to their site. */
export function matchSiteAsk(raw: string, page: SitePage, tips: string[]): WedReply {
  const text = raw.toLowerCase();
  const orNothing = (p: SiteProposal | null, sayKey: string): WedReply =>
    p ? { kind: 'proposal', proposal: p } : { kind: 'nothing', sayKey };

  if (has(text, ['set it up', 'set up', 'do it for me', 'fill it', 'everything', 'start'])) {
    return orNothing(setUpProposal(page, tips), 'website.wed.say.allDone');
  }
  if (has(text, ['missing', 'check', 'ready', 'anything else', 'what else', 'forgot'])) {
    return { kind: 'missing', parts: missingParts(page) };
  }
  if (has(text, ['publish', 'go live', 'make it live'])) {
    return page.publishedAt
      ? { kind: 'nothing', sayKey: 'website.wed.say.alreadyLive' }
      : {
          kind: 'proposal',
          proposal: {
            sayKey: 'website.wed.say.publish',
            lines: [{ key: 'website.wed.lines.publish' }],
            actions: [{ kind: 'publish' }],
          },
        };
  }
  if (has(text, ['wear', 'dress', 'outfit', 'clothes', 'attire'])) {
    return orNothing(dressProposal(page), 'website.wed.say.dressDone');
  }
  if (has(text, ['photo', 'picture', 'cover photo'])) {
    return {
      kind: 'open',
      sayKey: 'website.wed.say.photo',
      href: '/website/cover',
      buttonKey: 'website.wed.openPhoto',
    };
  }
  if (
    has(text, [
      'guide',
      'gurdwara',
      'mosque',
      'mandir',
      'temple',
      'church',
      'etiquette',
      'shoes',
      'cover your head',
      'tips',
    ])
  ) {
    return orNothing(guideProposal(page, tips), 'website.wed.say.guideDone');
  }
  if (has(text, ['welcome', 'intro', 'greeting', 'message'])) {
    return orNothing(welcomeProposal(page), 'website.wed.say.welcomeDone');
  }
  if (has(text, ['story', 'how we met', 'proposal'])) {
    return {
      kind: 'open',
      sayKey: 'website.wed.say.story',
      href: '/website/story',
      buttonKey: 'website.wed.openStory',
    };
  }
  if (has(text, ['hotel', 'stay', 'travel', 'room'])) {
    return {
      kind: 'open',
      sayKey: 'website.wed.say.hotel',
      href: '/website/list?kind=hotel',
      buttonKey: 'website.wed.openHotels',
    };
  }
  if (has(text, ['livestream', 'live stream', 'zoom', 'youtube', 'watch'])) {
    return {
      kind: 'open',
      sayKey: 'website.wed.say.live',
      href: '/website/livestream',
      buttonKey: 'website.wed.openLive',
    };
  }

  const look = LOOKS.find((l) => has(text, l.words));
  if (look)
    return orNothing(
      lookProposal(page, look.design, look.palette, look.nameKey),
      'website.wed.say.sameLook',
    );
  return { kind: 'help' };
}

/**
 * The actions with their words filled in (a dress code or welcome line is an
 * i18n key until then).
 */
export function wordActions(actions: SiteAction[], t: Translate, names: string): SiteAction[] {
  return actions.map((a) => {
    if (a.kind === 'event' && a.details.dress_code) {
      return { ...a, details: { ...a.details, dress_code: t(a.details.dress_code) } };
    }
    if (a.kind === 'update') {
      const changes = { ...a.changes };
      if (changes.welcome) changes.welcome = t(changes.welcome, { names });
      if (changes.guide_title) changes.guide_title = t(changes.guide_title);
      return { ...a, changes };
    }
    return a;
  });
}

/** What puts the site back the way it was before these actions (Undo). */
export function undoActions(actions: SiteAction[], page: SitePage): SiteAction[] {
  return actions.map((a): SiteAction => {
    switch (a.kind) {
      case 'update': {
        const before: SiteChanges = {};
        for (const key of Object.keys(a.changes) as (keyof SiteChanges)[]) {
          (before as Record<string, unknown>)[key] = pageValue(page, key);
        }
        return { kind: 'update', changes: before };
      }
      case 'items':
        return {
          kind: 'items',
          list: a.list,
          items: a.list === 'tip' ? page.tips : a.list === 'hotel' ? page.hotels : page.faq,
        };
      case 'event': {
        const e = page.events.find((x) => x.slug === a.eventSlug);
        return {
          kind: 'event',
          eventSlug: a.eventSlug,
          details: {
            dress_code: e?.dressCode ?? null,
            dress_colors: e?.dressColors ?? [],
          },
        };
      }
      case 'publish':
      case 'unpublish':
        return { kind: page.publishedAt ? 'publish' : 'unpublish' };
    }
  });
}

function pageValue(page: SitePage, key: keyof SiteChanges): unknown {
  const map: Record<keyof SiteChanges, unknown> = {
    design: page.design,
    palette: page.palette,
    welcome: page.welcome,
    story: page.story,
    family_title: page.familyTitle,
    family_lines: page.familyLines,
    guide_title: page.guideTitle,
    livestream_url: page.livestreamUrl,
    livestream_note: page.livestreamNote,
    rsvp_by: page.rsvpBy,
    sections: page.sections,
    searchable: page.searchable,
  };
  return map[key];
}
