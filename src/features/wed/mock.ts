import type { Href } from 'expo-router';

import type { IconName } from '@/components/icon';
import { photoUrl } from '@/data/vendor-media';

import type { WedContext } from './wed-store';

/**
 * MOCKUP ONLY. One made-up family's wedding for the Wed preview (the Wed tab
 * and its pages): Simran's family, with Simran as the owner and Harjit as an
 * editor. The vendors are sample vendors from seed.sql with their
 * placeholder photos; nothing here is read from or written to an account.
 */

export type MockVendor = {
  slug: string;
  name: string;
  type: string;
  city: string;
  price: string;
  photo: string;
  blurhash: string;
  /** One line on why Wed picked it. */
  why?: string;
  /** "free Jun 12 · 2 mi", under the price on a vendor card in the thread. */
  fit?: string;
};

const photo = (path: string) => photoUrl(path, 'small');

/** Who's planning: the one signed in, and the two who can say yes to Wed's cards. */
export const FAMILY = {
  me: 'Simran',
  /** How Simran signs a message to a vendor. */
  // A no-break space, so "K." never sits alone on a line
  signature: 'Simran\u00A0K.',
  owner: 'Simran',
  editor: 'Harjit',
  approvers: 'Simran or Harjit',
  email: 'simran.k@example.com',
} as const;

export const WEDDING = {
  couple: 'Simran & Arjun',
  date: '2027-06-13',
  dateWords: 'Sat, Jun 13, 2027',
  city: 'Yuba City',
  booked: 5,
  essentials: 12,
  cover: photoUrl(
    '00000000-0000-4000-8000-000000000001/355ce566-f945-4f6f-8269-24c2c65c7f9c',
    'medium',
  ),
  coverBlurhash: 'LMJjetx]ENxu}Rx]t8fQ-pjERjWC',
};

/** Whole days from today to the wedding: 243 on Oct 13, 2026. */
export function daysToGo(now = new Date()): number {
  const [year, month, day] = WEDDING.date.split('-').map(Number);
  const wedding = Date.UTC(year, month - 1, day);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((wedding - today) / 86_400_000));
}

/** "Good morning" / "Good afternoon" / "Good evening", by the phone's clock. */
export function greetingWords(now = new Date()): string {
  const hour = now.getHours();
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

export const DHOL: MockVendor[] = [
  {
    slug: 'dhol-di-awaaz',
    name: 'Dhol Di Awaaz',
    type: 'Dhol',
    city: 'Yuba City · 2 mi',
    price: '$350',
    photo: photo('00000000-0000-4000-8000-000000000013/ddf896a7-aede-46d8-81ce-bd442b0b4e10'),
    blurhash: 'L6Ee3[E,0ymk}k-AIV%L00I:=|tR',
    why: 'Booked by 14 families here',
    fit: 'free Jun 12 · 2 mi',
  },
  {
    slug: 'pind-beat-dholis',
    name: 'Pind Beat Dholis',
    type: 'Dhol',
    city: 'Lodi · travels to you',
    price: '$380',
    photo: photo('00000000-0000-4000-8000-000000000081/740d7d0e-3e0e-4c15-8ec0-d98d9a99cbdb'),
    blurhash: 'LPGbFxxF9axu~of+IUxtK$SNROxa',
    why: 'Replies within an hour',
    fit: 'free Jun 12 · travels to you',
  },
  {
    slug: 'gabru-dhol-crew',
    name: 'Gabru Dhol Crew',
    type: 'Dhol',
    city: 'Manteca · travels to you',
    price: '$400',
    photo: photo('00000000-0000-4000-8000-000000000005/b5fb7826-dc40-4022-83fa-67deb1ab20fc'),
    blurhash: 'LBEw~.yDpH^%}7rWng#7KOx[KPK6',
    why: 'Founding vendor',
    fit: 'free Jun 12 · travels to you',
  },
];

export const PHOTOGRAPHERS: MockVendor[] = [
  {
    slug: 'kesri-frames',
    name: 'Kesri Frames',
    type: 'Photographer',
    city: 'Yuba City',
    price: '$2,800',
    photo: photo('00000000-0000-4000-8000-000000000086/1f55794f-8e95-48b3-8ddd-e5222b17e1e6'),
    blurhash: 'LOID{%vg_MEf_MgMxu%1J7tRs;xu',
    fit: 'free Jun 10 · 3 mi',
  },
  {
    slug: 'frames-by-jas',
    name: 'Frames by Jas',
    type: 'Photographer',
    city: 'Sacramento',
    price: '$2,500',
    photo: photo('00000000-0000-4000-8000-000000000017/d7107f64-9891-4562-8288-eb67dffe7b4d'),
    blurhash: 'LOID{%vg_MEf_MgMxu%1J7tRs;xu',
    fit: 'free Jun 10 · 41 mi',
  },
  {
    slug: 'lens-and-laavan-studio',
    name: 'Lens & Laavan Studio',
    type: 'Photographer',
    city: 'Elk Grove',
    price: '$2,200',
    photo: photo('00000000-0000-4000-8000-000000000087/6ec31074-a4c5-4f19-8049-b6de2192134d'),
    blurhash: 'LBKKco0K00?vw?9F?Gt7*0W9VsV@',
    fit: 'free Jun 10 · travels to you',
  },
];

export const HALL: MockVendor = {
  slug: 'royal-orchard-banquet-hall',
  name: 'Royal Orchard Banquet Hall',
  type: 'Banquet hall',
  city: 'Yuba City',
  price: '$55 a plate',
  photo: photo('00000000-0000-4000-8000-000000000001/355ce566-f945-4f6f-8269-24c2c65c7f9c'),
  blurhash: 'LMJjetx]ENxu}Rx]t8fQ-pjERjWC',
};

export const CATERER: MockVendor = {
  slug: 'saffron-tandoor-catering',
  name: 'Saffron Tandoor Catering',
  type: 'Caterer',
  city: 'Yuba City',
  price: '$18 a person',
  photo: photo('00000000-0000-4000-8000-000000000011/e29d5c74-a44a-4625-843a-4fb240bab647'),
  blurhash: 'LKIh1.=xD*IUyCRit7%g~pE1E2xu',
};

export type FoundPage = {
  /** "@punjabibeats_916" */
  handle: string;
  /** "Instagram · Yuba City" */
  detail: string;
  url: string;
};

/** Pages Wed found on the web that aren't on Wedded, shown after the vendor cards. */
export const FOUND_PAGES: FoundPage[] = [
  {
    handle: '@punjabibeats_916',
    detail: 'Instagram · Yuba City',
    url: 'https://www.instagram.com/punjabibeats_916/',
  },
];

export type Starter = { icon: IconName; text: string };

/** The three read-only things to try under the greeting; tapping one sends it at once. */
export const STARTERS: Starter[] = [
  { icon: 'search-outline', text: 'Find a dhol player for the Jaago' },
  { icon: 'chatbubble-outline', text: 'Ask Royal Orchard about parking and music' },
  { icon: 'list-outline', text: "What's left to book for the Mehndi?" },
];

export type MockEvent = {
  name: string;
  slug: string;
  /** "Jun 10, 2027" */
  when: string;
  /** What its invitation card says: the day (yyyy-mm-dd), the time and the place. */
  card: { date: string; time: string; place: string };
  done: number;
  total: number;
  note: string;
  /** Wed's answer to "What's left to book for the …?" (the Mehndi has its own flow). */
  left: string;
};

/** The family's events, essentials booked of essentials needed (5 of 12 in all). */
export const EVENTS: MockEvent[] = [
  {
    name: 'Roka',
    slug: 'roka',
    when: 'Mar 20, 2027',
    card: { date: '2027-03-20', time: '11 in the morning', place: 'At home, Yuba City' },
    done: 2,
    total: 2,
    note: 'All booked',
    left: 'The Roka is all booked, 2 of 2. Nothing is left to do there.',
  },
  {
    name: 'Mehndi',
    slug: 'mehndi',
    when: 'Jun 10, 2027',
    card: { date: '2027-06-10', time: '6 in the evening', place: 'At home, Yuba City' },
    done: 0,
    total: 2,
    note: 'A tasting at Saffron Tandoor waits for your OK',
    left: '',
  },
  {
    name: 'Jaago',
    slug: 'jaago',
    when: 'Fri, Jun 12, 2027',
    card: { date: '2027-06-12', time: '8 at night', place: 'At home, Yuba City' },
    done: 1,
    total: 3,
    note: 'Wed is finding a dhol player',
    left: 'The Jaago has 1 of 3 booked. A dhol player and a sound system are left. Want me to look for a dhol player first?',
  },
  {
    name: 'Anand Karaj',
    slug: 'anand-karaj',
    when: 'Sat, Jun 13, 2027',
    card: { date: '2027-06-13', time: '9:30 in the morning', place: 'Gurdwara Sahib, Yuba City' },
    done: 1,
    total: 2,
    note: 'Next: a photographer',
    left: 'The Anand Karaj has 1 of 2 booked. A photographer is left, and Kesri Frames is free on June 13. Want me to ask them?',
  },
  {
    name: 'Reception',
    slug: 'reception',
    when: 'Sat, Jun 13, 2027',
    card: {
      date: '2027-06-13',
      time: '6 in the evening',
      place: 'Royal Orchard Banquet Hall, Yuba City',
    },
    done: 1,
    total: 3,
    note: 'Tour at Royal Orchard to book',
    left: "The Reception has 1 of 3 booked. A DJ and a decorator are left, and Royal Orchard's tour is still to book. Want me to start with the tour?",
  },
];

export type MockGoal = MockEvent & { about: WedContext };

/** One goal per event (the Goals page): the event, and what "Talk about it" opens Wed with. */
export const GOALS: MockGoal[] = EVENTS.map((event) => ({
  ...event,
  about: { kind: 'event', id: event.slug, label: event.name },
}));

export type MockWatch = { id: string; title: string; detail: string };

/** What Wed checks on by itself and tells the family about only when it changes. */
export const WATCHES: MockWatch[] = [
  {
    id: 'hall',
    title: 'Tell me if a hall opens on Jun 13',
    detail: 'Checks every morning · last checked 7:00 AM',
  },
  {
    id: 'photographer',
    title: 'Tell me if Kesri Frames frees up on Jun\u00A013',
    detail: 'Checks every morning · last checked 7:00 AM',
  },
  {
    id: 'lehenga',
    title: 'Tell me if the red and gold lehenga drops under $1,400',
    detail: 'Checks once a week · last checked Monday',
  },
];

export type MockIdea = {
  id: string;
  icon: IconName;
  title: string;
  why: string;
  ask: string;
  /** A later feature: its button says "See how it works", not "Start". */
  preview?: boolean;
};

/** The Ideas page: things Wed can start from the plan. `ask` is sent as is. */
export const IDEAS: MockIdea[] = [
  {
    id: 'ghori',
    icon: 'ribbon-outline',
    title: 'Find a ghori for the Baraat',
    why: 'Your Baraat has no ghori yet',
    ask: 'Find a ghori for the Baraat',
  },
  {
    id: 'compare',
    icon: 'git-compare-outline',
    title: 'Compare the 3 dhol players',
    why: '2 have replied',
    ask: 'Compare the 3 dhol players',
  },
  {
    id: 'deposit',
    icon: 'card-outline',
    title: "Pay Royal Orchard's deposit",
    why: 'Coming later. See how it works',
    ask: "Pay Royal Orchard's deposit",
    preview: true,
  },
  {
    id: 'mehndi',
    icon: 'brush-outline',
    title: 'Find a Mehndi artist free on Jun 10',
    why: 'The Mehndi has no artist yet',
    ask: 'Find a Mehndi artist free on Jun 10',
  },
];

export type LibraryRow = { label: string; value?: string };

export type LibraryList = {
  id: 'saved' | 'dhol' | 'budget' | 'jaago' | 'emails' | 'jaago-list';
  title: string;
  icon: IconName;
  /** "Made by Wed · Today" */
  meta?: string;
  /** On the right, in grey: "12", "$18,400 of $45,000". */
  value?: string;
  /** Opens a screen; lists without one expand to their `rows`. */
  href?: Href;
  rows?: LibraryRow[];
  /** Only there once Gmail is connected (flow D). */
  afterGmail?: boolean;
};

/** Lists and photos: what Wed has made and kept for the family. */
export const LIBRARY: LibraryList[] = [
  {
    id: 'saved',
    title: 'Your saved vendors',
    icon: 'heart-outline',
    href: '/saved',
  },
  {
    id: 'dhol',
    title: 'Dhol players compared',
    icon: 'git-compare-outline',
    meta: 'Made by Wed · Today',
    href: {
      pathname: '/compare',
      params: { vendors: 'dhol-di-awaaz,pind-beat-dholis,gabru-dhol-crew' },
    },
  },
  {
    id: 'budget',
    title: 'Wedding budget',
    icon: 'card-outline',
    meta: 'Made by Wed · Oct 2',
    value: '$18,400 of $45,000',
    rows: [
      { label: 'Royal Orchard Banquet Hall', value: '$6,500' },
      { label: 'Saffron Tandoor Catering', value: '$6,300' },
      { label: 'Everything else booked', value: '$5,600' },
    ],
  },
  {
    id: 'jaago',
    title: 'Jaago, the day of',
    icon: 'time-outline',
    meta: 'Made by Wed · Oct 9',
    rows: [
      { label: 'Family arrives at the house', value: '5:00 PM' },
      { label: 'Dinner from Saffron Tandoor', value: '6:00 PM' },
      { label: 'Jaago starts, dhol at the door', value: '7:30 PM' },
      { label: 'Bhangra and boliyan', value: '8:30 PM' },
      { label: 'Sweets and goodbyes', value: '10:30 PM' },
    ],
  },
  {
    id: 'emails',
    title: 'Emails from vendors',
    icon: 'mail-outline',
    meta: 'Made by Wed · Today',
    afterGmail: true,
    rows: [
      { label: 'Royal Orchard · the contract', value: 'Oct 8' },
      { label: 'Kesri Frames · a quote for $2,800', value: 'Oct 11' },
    ],
  },
];

/** A list from LIBRARY by id: what an `artifact` row in the thread shows and opens. */
export function libraryList(id: string): LibraryList | undefined {
  return LIBRARY.find((list) => list.id === id);
}

export type MockPhoto = { uri: string; blurhash: string; credit: string };

/** Six sample vendor-media photos for the Photos side of Lists and photos. */
export const PHOTOS: MockPhoto[] = [
  { uri: HALL.photo, blurhash: HALL.blurhash, credit: HALL.name },
  { uri: CATERER.photo, blurhash: CATERER.blurhash, credit: CATERER.name },
  ...DHOL.map((vendor) => ({ uri: vendor.photo, blurhash: vendor.blurhash, credit: vendor.name })),
  {
    uri: PHOTOGRAPHERS[0].photo,
    blurhash: PHOTOGRAPHERS[0].blurhash,
    credit: PHOTOGRAPHERS[0].name,
  },
];

export type Fact = {
  id: string;
  group: 'wedding' | 'wishes';
  text: string;
  /** "Shared with family", or "Only me". */
  shared: boolean;
};

/** What Wed knows (its memory), in two sections: Your wedding, Family wishes. */
export const FACTS: Fact[] = [
  { id: 'date', group: 'wedding', text: 'The wedding is Sat, Jun 13, 2027', shared: true },
  { id: 'jaago', group: 'wedding', text: 'Jaago is Fri, Jun 12 in Yuba City', shared: true },
  {
    id: 'guests',
    group: 'wedding',
    text: 'About 150 guests at the Jaago and 350 at the Reception',
    shared: true,
  },
  { id: 'budget', group: 'wedding', text: 'The budget is $45,000', shared: false },
  {
    id: 'approvers',
    group: 'wedding',
    text: 'Simran and Harjit can say yes to what Wed asks',
    shared: true,
  },
  { id: 'dhol', group: 'wishes', text: 'Dadi ji wants a live dhol at the Jaago', shared: true },
  {
    id: 'veg',
    group: 'wishes',
    text: 'Only vegetarian food at the Anand Karaj',
    shared: true,
  },
  { id: 'colours', group: 'wishes', text: 'Simran loves red and gold', shared: false },
];

export type AppId =
  | 'wedded'
  | 'family'
  | 'maps'
  | 'web'
  | 'calendar'
  | 'gmail'
  | 'wedEmail'
  | 'googleCalendar'
  | 'pay'
  | 'spending';

export type AppMeta = {
  id: AppId;
  title: string;
  /** A plain outlined Ionicon, never the brand's own art. */
  icon: IconName;
  /** What Wed can do with it, in a few words. */
  access: string;
  group: 'builtIn' | 'connect' | 'soon';
};

/** Apps Wed can use, in the order the Apps page lists them. */
export const APPS: AppMeta[] = [
  {
    id: 'wedded',
    title: 'Wedded vendors & messages',
    icon: 'chatbubbles-outline',
    access: 'Messages vendors only with your OK',
    group: 'builtIn',
  },
  {
    id: 'family',
    title: 'Your family',
    icon: 'people-outline',
    access: 'People who share your plan',
    group: 'builtIn',
  },
  {
    id: 'maps',
    title: 'Google Maps',
    icon: 'map-outline',
    access: 'Only looks · finds vendors near you',
    group: 'builtIn',
  },
  {
    id: 'web',
    title: 'Pages on the web',
    icon: 'globe-outline',
    access: 'Only looks · finds vendor pages, including Instagram',
    group: 'builtIn',
  },
  {
    id: 'calendar',
    title: 'Phone calendar',
    icon: 'calendar-outline',
    access: 'Adds tours and event dates',
    group: 'connect',
  },
  {
    id: 'gmail',
    title: 'Gmail',
    icon: 'mail-outline',
    access: 'Only reads · emails from your vendors',
    group: 'soon',
  },
  {
    id: 'wedEmail',
    title: "Wed's email address",
    icon: 'at-outline',
    access: 'Vendors can email Wed directly',
    group: 'soon',
  },
  {
    id: 'googleCalendar',
    title: 'Google Calendar',
    icon: 'calendar-outline',
    access: 'Adds tours and event dates to Google Calendar',
    group: 'soon',
  },
  {
    id: 'pay',
    title: 'Pay deposits',
    icon: 'card-outline',
    access: 'With your OK every time',
    group: 'soon',
  },
  {
    id: 'spending',
    title: 'Wedding spending',
    icon: 'stats-chart-outline',
    access: "Bank, only looks · can't move money",
    group: 'soon',
  },
];

/** An app's details by id. */
export function appMeta(id: AppId): AppMeta {
  return APPS.find((app) => app.id === id) ?? APPS[0];
}
