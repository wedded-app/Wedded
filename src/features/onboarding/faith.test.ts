import type { Tradition, TraditionEvent } from '@/data/reference';

import {
  answersForTraditions,
  eventChoices,
  faithOptions,
  faithsNeedingRoots,
  faithWide,
  planFor,
  startingChoice,
  previewEvents,
  tellingEvents,
  traditionsForFaiths,
} from './faith';

/** A main event (`*` in front of the slug means not a main one). */
const event = (spec: string, phase: string, order: number): TraditionEvent => ({
  slug: spec.replace('*', ''),
  name: { en: spec.replace('*', '') },
  phase,
  order,
  isCore: !spec.startsWith('*'),
  timing: null,
  vendorTypeCount: 0,
  vendorCount: 0,
});
const culture = (
  slug: string,
  background: string | null,
  faith: string | null,
  events: [string, string][] = [],
): Tradition => ({
  slug,
  name: { en: slug },
  isDefault: slug === 'punjabi-sikh',
  backgroundSlug: background,
  faithSlug: faith,
  events: events.map(([spec, phase], index) => event(spec, phase, index + 1)),
});
const all = [
  culture('punjabi-sikh', 'punjabi', 'sikh'),
  culture('punjabi-hindu', 'punjabi', 'hindu'),
  culture('pakistani', 'pakistani', 'muslim'),
  culture('muslim', null, 'muslim'),
  culture('arab', 'arab', 'muslim'),
  culture('christian', null, 'christian'),
];
const faith = (slug: string) => ({ slug, name: { en: slug } });
const slugs = (traditions: (Tradition | undefined)[]) => traditions.map((t) => t?.slug);

describe('faithOptions', () => {
  it('lists the faiths that have a tradition, in order, with their traditions', () => {
    const options = faithOptions([faith('sikh'), faith('jain'), faith('muslim')], all);
    expect(options.map((o) => o.faith.slug)).toEqual(['sikh', 'muslim']);
    expect(slugs(options[1].traditions)).toEqual(['pakistani', 'muslim', 'arab']);
  });
});

describe('faithWide', () => {
  it('prefers the tradition without a place, then the first', () => {
    expect(faithWide(all.filter((t) => t.faithSlug === 'muslim'))?.slug).toBe('muslim');
    expect(faithWide(all.filter((t) => t.faithSlug === 'sikh'))?.slug).toBe('punjabi-sikh');
    expect(faithWide([])).toBeUndefined();
  });
});

describe('faithsNeedingRoots', () => {
  it('asks where the families are from only when the faith has a choice', () => {
    expect(faithsNeedingRoots(['sikh', 'muslim', 'christian'], all)).toEqual(['muslim']);
    expect(faithsNeedingRoots(['sikh', 'hindu'], all)).toEqual([]);
  });
});

describe('traditionsForFaiths', () => {
  it("uses the faith's own tradition when there's nothing to ask", () => {
    expect(slugs(traditionsForFaiths(['sikh'], [], all))).toEqual(['punjabi-sikh']);
    expect(slugs(traditionsForFaiths(['christian'], [], all))).toEqual(['christian']);
  });

  it('uses the places picked, or the faith-wide tradition when none were', () => {
    expect(slugs(traditionsForFaiths(['muslim'], ['arab'], all))).toEqual(['arab']);
    expect(slugs(traditionsForFaiths(['muslim'], ['pakistani', 'arab'], all))).toEqual([
      'pakistani',
      'arab',
    ]);
    expect(slugs(traditionsForFaiths(['muslim'], [], all))).toEqual(['muslim']);
  });

  it("handles a mixed wedding, in the founders' order", () => {
    expect(slugs(traditionsForFaiths(['muslim', 'sikh'], ['pakistani'], all))).toEqual([
      'punjabi-sikh',
      'pakistani',
    ]);
  });

  it('drops places picked under a faith that was unpicked', () => {
    expect(slugs(traditionsForFaiths(['hindu'], ['pakistani'], all))).toEqual(['punjabi-hindu']);
    expect(traditionsForFaiths([], ['pakistani'], all)).toEqual([]);
  });
});

describe('answersForTraditions', () => {
  it('turns traditions back into answers that lead to them', () => {
    const picked = all.filter((t) => ['punjabi-sikh', 'arab'].includes(t.slug));
    const answers = answersForTraditions(picked);
    expect(answers).toEqual({ faiths: ['sikh', 'muslim'], roots: ['punjabi-sikh', 'arab'] });
    expect(slugs(traditionsForFaiths(answers.faiths, answers.roots, all))).toEqual([
      'punjabi-sikh',
      'arab',
    ]);
  });
});

describe('tellingEvents', () => {
  const muslim = culture('muslim', null, 'muslim', [
    ['engagement', 'before'],
    ['mehndi', 'before'],
    ['nikah', 'wedding_day'],
    ['walima', 'after'],
    ['whole-wedding', 'whole_wedding'],
  ]);
  const pakistani = culture('pakistani', 'pakistani', 'muslim', [
    ['engagement', 'before'],
    ['dholki', 'before'],
    ['mayun', 'before'],
    ['mehndi', 'before'],
    ['nikah', 'wedding_day'],
    ['shadi', 'wedding_day'],
    ['*rukhsati', 'wedding_day'],
    ['walima', 'after'],
    ['whole-wedding', 'whole_wedding'],
  ]);
  const arab = culture('arab', 'arab', 'muslim', [
    ['engagement', 'before'],
    ['mehndi', 'before'],
    ['nikah', 'before'],
    ['zaffa', 'wedding_day'],
    ['reception', 'wedding_day'],
    ['*walima', 'after'],
    ['whole-wedding', 'whole_wedding'],
  ]);
  const names = (events: TraditionEvent[]) => events.map((e) => e.slug);

  it("names what a place has that the faith-wide wedding doesn't", () => {
    expect(names(tellingEvents(pakistani, muslim))).toEqual(['dholki', 'mayun', 'shadi']);
  });

  it('tops up with the signature events, in ceremony order', () => {
    expect(names(tellingEvents(arab, muslim))).toEqual(['nikah', 'zaffa', 'reception']);
  });

  it('shows the faith-wide wedding by its signature events', () => {
    expect(names(tellingEvents(muslim, muslim))).toEqual(['mehndi', 'nikah', 'walima']);
    expect(names(tellingEvents(pakistani, undefined))).toEqual(['mehndi', 'nikah', 'walima']);
  });
});

describe('previewEvents', () => {
  const sikh = culture('punjabi-sikh', 'punjabi', 'sikh', [
    ['roka', 'before'],
    ['jaago', 'before'],
    ['baraat', 'wedding_day'],
    ['anand-karaj', 'wedding_day'],
    ['reception', 'wedding_day'],
    ['whole-wedding', 'whole_wedding'],
  ]);
  const christian = culture('christian', null, 'christian', [
    ['engagement', 'before'],
    ['church-wedding', 'wedding_day'],
    ['reception', 'wedding_day'],
    ['whole-wedding', 'whole_wedding'],
  ]);

  it('names the signature events and counts the rest, without Whole wedding', () => {
    const preview = previewEvents([sikh]);
    expect(preview.events.map((e) => e.slug)).toEqual(['jaago', 'baraat', 'anand-karaj']);
    expect(preview.more).toBe(2);
  });

  it("takes each tradition's in turn for a mixed wedding, once each", () => {
    const preview = previewEvents([sikh, christian], 4);
    expect(preview.events.map((e) => e.slug)).toEqual([
      'jaago',
      'baraat',
      'anand-karaj',
      'engagement',
    ]);
    expect(preview.more).toBe(3);
  });

  it('is empty before they pick', () => {
    expect(previewEvents([])).toEqual({ events: [], more: 0 });
  });
});

describe('the events to offer and the plan they make', () => {
  const pakistani = culture('pakistani', 'pakistani', 'muslim', [
    ['mangni', 'before'],
    ['dholki', 'before'],
    ['mayun', 'before'],
    ['mehndi', 'before'],
    ['nikah', 'wedding_day'],
    ['shadi', 'wedding_day'],
    ['*rukhsati', 'wedding_day'],
    ['walima', 'after'],
    ['whole-wedding', 'whole_wedding'],
  ]);
  const muslim = culture('muslim', null, 'muslim', [
    ['engagement', 'before'],
    ['mehndi', 'before'],
    ['nikah', 'wedding_day'],
    ['*reception', 'wedding_day'],
    ['walima', 'after'],
    ['whole-wedding', 'whole_wedding'],
  ]);
  const sikh = culture('punjabi-sikh', 'punjabi', 'sikh', [
    ['jaago', 'before'],
    ['anand-karaj', 'wedding_day'],
    ['whole-wedding', 'whole_wedding'],
  ]);
  const traditions = [pakistani, muslim, sikh];
  const names = (events: TraditionEvent[]) => events.map((e) => e.slug);

  it("ticks the tradition's main events and offers the rest of the faith's", () => {
    const { main, more } = eventChoices([muslim], traditions);
    expect(names(main)).toEqual(['engagement', 'mehndi', 'nikah', 'walima']);
    expect(names(more)).toEqual(['mangni', 'dholki', 'mayun', 'reception', 'shadi', 'rukhsati']);
  });

  it('starts with the main events and any named in a search', () => {
    const { main, ordered } = eventChoices([muslim], traditions);
    expect(startingChoice(main, ordered, ['dholki', 'nikah', 'jaago'])).toEqual([
      'engagement',
      'mehndi',
      'nikah',
      'walima',
      'dholki',
    ]);
  });

  it('offers every event, none ticked, for something else', () => {
    const { main, more } = eventChoices([], traditions);
    expect(main).toEqual([]);
    expect(names(more)).toContain('jaago');
    expect(names(more)).toContain('dholki');
    expect(names(more)).not.toContain('whole-wedding');
  });

  it('brings in the tradition an added event comes from, and the Whole wedding card', () => {
    const plan = planFor(['mehndi', 'dholki', 'nikah'], [muslim], traditions);
    expect(slugs(plan.traditions)).toEqual(['pakistani', 'muslim']);
    expect(plan.events).toEqual(['mehndi', 'dholki', 'nikah', 'whole-wedding']);
  });

  it('keeps to the traditions they picked when nothing else is needed', () => {
    const plan = planFor(['nikah', 'walima'], [muslim], traditions);
    expect(slugs(plan.traditions)).toEqual(['muslim']);
    expect(plan.events).toEqual(['nikah', 'walima', 'whole-wedding']);
  });

  it('finds the traditions for a plan made from something else', () => {
    const plan = planFor(['jaago'], [], traditions);
    expect(slugs(plan.traditions)).toEqual(['punjabi-sikh']);
    expect(plan.events).toEqual(['jaago', 'whole-wedding']);
  });
});
