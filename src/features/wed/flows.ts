import {
  CATERER,
  DHOL,
  EVENTS,
  FAMILY,
  FOUND_PAGES,
  HALL,
  PHOTOGRAPHERS,
  type FoundPage,
  type MockVendor,
} from './mock';
import type { ApprovalSpec, Source, TaskSpec, WedContext } from './wed-store';

/**
 * MOCKUP: the scripted conversations behind the Wed tab. In the real app
 * Wed's brain decides what to say and do; here what the family sends is
 * matched to a flow by its words (matchFlow), and the flow plays its ops on
 * a clock, `at` milliseconds after it starts. The store (wed-store.ts) runs
 * them, so they keep playing off the tab. "{q}" in a flow's words is filled
 * with what the family asked about (a vendor's name, a search).
 *
 * The channel is always true to the app: Wed's first contact with a vendor
 * goes through Ask about price & date (send-inquiry), sharing the family's
 * first name and phone; a follow-up in an existing chat shares nothing new.
 */

export type FlowKey =
  | 'dhol'
  | 'dholReply'
  | 'dholBooked'
  | 'hall'
  | 'hallFree'
  | 'hallReply'
  | 'tourBooked'
  | 'tastingBooked'
  | 'deposit'
  | 'gmail'
  | 'calendar'
  | 'modeSmall'
  | 'modeAsk'
  | 'free'
  | 'reel'
  | 'compare'
  | 'ghori'
  | 'mehndiArtist'
  | 'left'
  | 'eventLeft'
  | 'next'
  | 'rest'
  | 'watch'
  | 'look'
  | 'photo'
  | 'unsave'
  | 'untour'
  | 'fallback';

export type Op =
  | { op: 'say'; text: string }
  /** A working line in the thread, with its steps and live sources. */
  | { op: 'task'; task: TaskSpec }
  /** The task moves on to its next step. */
  | { op: 'step'; taskId: string }
  | { op: 'finish'; taskId: string; summary: string }
  | { op: 'vendors'; vendors: MockVendor[]; found?: FoundPage[] }
  | { op: 'approval'; a: ApprovalSpec }
  /** A vendor's message, quoted in the thread. */
  | { op: 'reply'; vendor: MockVendor; who: string; text: string }
  | { op: 'receipt'; text: string; undoFlow?: FlowKey }
  | { op: 'artifact'; id: string }
  /** The STARTERS rows. */
  | { op: 'starters' }
  /** Only when the family chose "Do the small things". */
  | { op: 'onlyIfSmall'; then: Op }
  /** Wed waits on someone: the status line says so until endWait. */
  | { op: 'wait'; id: string; title: string; short: string }
  | { op: 'endWait'; id: string };

export type Flow = {
  /** Lowercase words; any one of them in the message picks this flow. */
  triggers: string[];
  /** Lowercase words that must all be in the message too. */
  also?: string[];
  /** Pulls "{q}" out of the message, from the first group. */
  capture?: RegExp;
  /** "{q}" when nothing was captured. */
  fill?: string;
  ops: { at: number; do: Op }[];
};

const say = (text: string): Op => ({ op: 'say', text });

const GURPREET = {
  name: 'Gurpreet · Royal Orchard',
  photo: HALL.photo,
  blurhash: HALL.blurhash,
  slug: HALL.slug,
};
const FIRST_CONTACT = "Your first name, phone, date, city and guest count. That's all.";
// How a signature follows a message: the dash stays with the name (a line
// may break after a dash, even before a no-break space, so a word joiner)
const SIGNED = `–\u2060\u00A0${FAMILY.signature}`;

// Flow A: finding a dhol player for the Jaago

const DHOL_TASK: TaskSpec = {
  id: 'dhol',
  title: 'Finding dhol players',
  steps: [
    {
      label: 'Reading your plan',
      short: 'Reading your plan',
      sources: [
        {
          kind: 'plan',
          label: 'Your plan',
          detail: 'Jaago · Fri, Jun 12 · Yuba City · 150 guests',
        },
      ],
      result: 'Jaago · Fri, Jun 12 · Yuba City · 150 guests',
    },
    {
      label: 'Searching Wedded for dhol players',
      short: 'Searching Wedded for dhol players',
      sources: DHOL.map((vendor): Source => ({
        kind: 'wedded',
        label: 'Wedded',
        detail: `${vendor.name} · ${vendor.city}`,
        photo: vendor.photo,
      })),
      result: 'Wedded: 3 near Yuba City',
    },
    {
      label: "Finding dhol players' Instagram pages near Yuba City",
      short: 'Looking for Instagram pages',
      sources: ['dholdiawaaz', 'punjabibeats_916', 'gabru.dhol', 'yubacitybhangra'].map(
        (handle): Source => ({
          kind: 'web',
          label: 'Pages on the web',
          detail: `instagram.com/${handle}`,
        }),
      ),
      result: '4 Instagram pages found on the web, 3 are the same players',
    },
    {
      label: "Checking who's free on Jun 12",
      short: "Checking who's free on Jun 12",
      sources: DHOL.map((vendor): Source => ({
        kind: 'calendar',
        label: 'Calendar',
        detail: `${vendor.name} · updated this month`,
      })),
      result: 'All 3 on Wedded are free',
    },
  ],
};

const ASK_DHOL: ApprovalSpec = {
  id: 'ask-dhol',
  kind: 'ask',
  title: "Ask 3 dhol players if they're free on Friday, June 12",
  verb: 'Ask all 3',
  to: DHOL.map(({ name, photo, blurhash, slug }) => ({ name, photo, blurhash, slug })),
  forLine: 'Jaago · Fri, Jun 12, 2027',
  message: `Sat Sri Akal! We're looking for a dhol player for our Jaago on Friday, June 12, 2027 in Yuba City, about 150 guests. Are you free, and what do you charge for two hours? ${SIGNED}`,
  shares: FIRST_CONTACT,
  sharesShort: 'Shares your first name and phone',
  cost: 'Free',
  undo: 'You can undo for 10 seconds',
  heldText: 'Sent to 3 dhol players',
  receipt: 'Asked 3 dhol players',
  waiting: 'Waiting for 3 dhol players to reply',
  then: { flow: 'dholReply', after: 12_000 },
};

const BOOK_DHOL: ApprovalSpec = {
  id: 'book-dhol',
  kind: 'markBooked',
  title: 'Mark Dhol Di Awaaz booked for the Jaago',
  verb: 'Mark booked',
  to: [{ name: DHOL[0].name, photo: DHOL[0].photo, blurhash: DHOL[0].blurhash }],
  forLine: 'Jaago · Fri, Jun 12, 2027',
  shares: 'Nothing. Only your family sees this',
  sharesShort: 'Shares nothing',
  cost: '$350, paid to them directly',
  undo: 'Mark not booked, any time',
  heldText: 'Marked Dhol Di Awaaz booked',
  receipt: 'Dhol Di Awaaz is booked for the Jaago',
  then: { flow: 'dholBooked', after: 1200 },
};

// Flow B: talking to the hall owner

const HALL_TASK: TaskSpec = {
  id: 'hall',
  title: 'Reading your chat with Royal Orchard',
  steps: [
    {
      label: 'Reading your chat with Royal Orchard',
      short: 'Reading your chat with Royal Orchard',
      sources: [
        { kind: 'chat', label: 'Your chat', detail: 'Royal Orchard Banquet Hall · 6 messages' },
      ],
      result: 'They seat 400, and outside caterers are OK',
    },
  ],
};

const HALL_MSG: ApprovalSpec = {
  id: 'hall-msg',
  kind: 'message',
  title: 'Send this to Gurpreet at Royal Orchard',
  verb: 'Send',
  to: [GURPREET],
  forLine: 'Reception · Sat, Jun 13, 2027',
  message:
    'Sat Sri Akal Gurpreet ji, two questions for our Reception on Sat, Jun 13: how many cars can park, and how late can the music go? Could we visit this Saturday?',
  shares: 'Nothing new. It goes in your chat with them',
  sharesShort: 'Shares nothing new',
  cost: 'Free',
  undo: 'You can undo for 10 seconds',
  heldText: 'Sent to Gurpreet',
  receipt: 'Sent to Gurpreet at Royal Orchard',
  waiting: 'Waiting for Gurpreet to reply',
  then: { flow: 'hallReply', after: 8000 },
};

const TOUR: ApprovalSpec = {
  id: 'tour',
  kind: 'tour',
  // One idea in the title; when it is goes in the For line
  title: 'Book a tour at Royal Orchard',
  verb: 'Book tour',
  to: [GURPREET],
  // The time held together, so it never breaks across lines
  forLine: 'Reception · tour Sat,\u00A0Oct\u00A017,\u00A011\u00A0AM',
  message: `Sat Sri Akal Gurpreet ji, could we see the hall this Saturday, Oct 17 at 11 AM? We'll be 4 people. ${SIGNED}`,
  shares: "Your first name and phone number. That's all.",
  sharesShort: 'Shares your first name and phone',
  cost: 'Free',
  undo: 'You can undo for 10 seconds',
  heldText: 'Tour booked',
  receipt: 'Booked a tour at Royal Orchard, Sat, Oct 17 at 11 AM',
  then: { flow: 'tourBooked', after: 1500 },
};

// Flow C: a deposit, shown as a later feature

const DEPOSIT: ApprovalSpec = {
  id: 'deposit',
  kind: 'pay',
  preview: true,
  title: 'Pay a $500 deposit to Royal Orchard',
  verb: 'Pay $500',
  altLabel: 'I paid another way',
  to: [GURPREET],
  forLine: 'Reception · Sat, Jun 13, 2027',
  shares: 'A one-time card number for this payment only',
  sharesShort: 'Shares a one-time card number',
  cost: '$500 now · $6,000 left, due May 13, 2027',
  undo: "Payments can't be undone. Refundable until Jan 13, 2027 under Royal Orchard's policy",
  footer: `Only ${FAMILY.owner} can pay. Wed never pays on its own.`,
  heldText: 'Paid $500',
  receipt: 'Preview: no money moved.',
  altReceipt: "Marked Royal Orchard's deposit paid",
};

const HALL_OPS: Flow['ops'] = [
  {
    at: 600,
    do: say('You already have a chat with Royal Orchard. Gurpreet, the owner, replies there.'),
  },
  { at: 1200, do: { op: 'task', task: HALL_TASK } },
  {
    at: 2600,
    do: {
      op: 'finish',
      taskId: 'hall',
      summary: 'Read 6 messages · they seat 400, and outside caterers are OK',
    },
  },
  {
    at: 3000,
    do: say("Parking and how late the music can go aren't in the chat yet. Want me to ask?"),
  },
  { at: 3400, do: { op: 'approval', a: HALL_MSG } },
];

/** Every flow, by name. */
export const FLOWS: Record<FlowKey, Flow> = {
  dhol: {
    triggers: ['dhol', 'ਢੋਲ', 'still need for the jaago'],
    ops: [
      {
        at: 600,
        do: say(
          "On it. I'll look for dhol players near Yuba City who are free on Friday, June 12.",
        ),
      },
      { at: 1400, do: { op: 'task', task: DHOL_TASK } },
      { at: 2400, do: { op: 'step', taskId: 'dhol' } },
      { at: 4400, do: { op: 'step', taskId: 'dhol' } },
      { at: 7400, do: { op: 'step', taskId: 'dhol' } },
      {
        at: 9000,
        do: { op: 'finish', taskId: 'dhol', summary: 'Worked 1 min · checked 14 pages' },
      },
      {
        at: 9400,
        do: say(
          "I found 4 dhol players. The 3 on Wedded are free on June 12. I only found Punjabi Beats on Instagram, so I can't check their date.",
        ),
      },
      { at: 9800, do: { op: 'vendors', vendors: DHOL, found: FOUND_PAGES } },
      {
        at: 10_200,
        do: {
          op: 'onlyIfSmall',
          then: { op: 'receipt', text: 'Saved 3 to your Jaago list', undoFlow: 'unsave' },
        },
      },
      // A beat after the vendors, so they're seen before the card
      { at: 11_800, do: { op: 'approval', a: ASK_DHOL } },
    ],
  },
  dholReply: {
    triggers: [],
    ops: [
      {
        at: 0,
        do: {
          op: 'reply',
          vendor: DHOL[0],
          who: 'Jaspal',
          text: 'Sat Sri Akal! Yes, free on June 12. $350 for two hours, two dholis.',
        },
      },
      {
        at: 900,
        do: say(
          "Dhol Di Awaaz is free and within budget. The other two haven't replied yet. I'll tell you when they do.",
        ),
      },
      {
        at: 1000,
        do: {
          op: 'wait',
          id: 'dhol-others',
          title: 'Waiting for 2 dhol players',
          short: 'Waiting for 2 dhol players to reply',
        },
      },
      { at: 1300, do: { op: 'approval', a: BOOK_DHOL } },
    ],
  },
  dholBooked: {
    triggers: [],
    ops: [
      { at: 0, do: { op: 'endWait', id: 'dhol-others' } },
      {
        at: 300,
        do: say(
          "That's the Jaago's dhol. 2 of 3 are booked now; the last one is a sound system. Want me to look for one?",
        ),
      },
    ],
  },
  hall: {
    triggers: ['royal orchard', 'parking', 'music'],
    ops: HALL_OPS,
  },
  // "Is Royal Orchard free on Jun 13, and what do they charge?" (the vendor
  // page's Ask Wed): the answer first, then the rest of the hall flow
  hallFree: {
    triggers: ['royal orchard'],
    also: ['free'],
    ops: [
      {
        at: 600,
        do: say(
          'Royal Orchard shows Sat, Jun 13 as open (calendar updated Oct 2). Their menus start at $55 a plate.',
        ),
      },
      ...HALL_OPS.map(({ at, do: op }) => ({ at: at + 900, do: op })),
    ],
  },
  hallReply: {
    triggers: [],
    ops: [
      {
        at: 0,
        do: {
          op: 'reply',
          vendor: HALL,
          who: 'Gurpreet',
          text: '300 cars on site, plus the lot next door. Music inside until 11 PM; an outside dhol must end by 10. Tours Saturdays 10 to 2.',
        },
      },
      { at: 900, do: say('Parking fits your 350 guests. Want to see it this Saturday?') },
      { at: 1300, do: { op: 'approval', a: TOUR } },
    ],
  },
  tourBooked: {
    triggers: [],
    ops: [
      { at: 0, do: say('Booked. After the tour I can help with the deposit.') },
      {
        at: 400,
        do: {
          op: 'onlyIfSmall',
          then: { op: 'receipt', text: 'Added the tour to your calendar', undoFlow: 'untour' },
        },
      },
    ],
  },
  tastingBooked: {
    triggers: [],
    ops: [
      {
        at: 0,
        do: say(
          `Booked. ${CATERER.name} will see you Sat, Oct 24 at 1 PM. I added it to your Mehndi plan.`,
        ),
      },
    ],
  },
  deposit: {
    triggers: ['deposit'],
    ops: [
      { at: 600, do: say("Paying through Wedded is coming later. Here's how it will work.") },
      { at: 1200, do: { op: 'approval', a: DEPOSIT } },
    ],
  },
  gmail: {
    triggers: [],
    ops: [
      {
        at: 0,
        do: say(
          "Gmail is connected (preview). I found 2 emails from your vendors: Royal Orchard's contract and a quote from Kesri Frames ($2,800).",
        ),
      },
      { at: 400, do: { op: 'artifact', id: 'emails' } },
    ],
  },
  calendar: {
    triggers: [],
    ops: [
      {
        at: 0,
        do: say(
          "Your phone calendar is connected. Tours and event dates will show up there, and I'll keep them up to date.",
        ),
      },
    ],
  },
  modeSmall: {
    triggers: [],
    ops: [
      {
        at: 300,
        do: say(
          "Okay. I'll save vendors, add tours to your calendar and set reminders on my own, and show each with Undo. I'll still ask before I message a vendor, book or pay.",
        ),
      },
    ],
  },
  modeAsk: {
    triggers: [],
    ops: [{ at: 300, do: say("Okay. I'll ask before everything.") }],
  },
  free: {
    triggers: ['free on', 'available'],
    capture: /\bis (.+?) (?:free|available)\b/i,
    fill: 'Royal Orchard',
    ops: [{ at: 600, do: say('{q} shows Sat, Jun 13 as open (calendar updated Oct 2).') }],
  },
  reel: {
    triggers: ['like this'],
    ops: [
      { at: 600, do: say("I'll look for vendors near Yuba City whose work looks like this reel.") },
      {
        at: 1000,
        do: {
          op: 'task',
          task: {
            id: 'reel',
            title: 'Finding vendors like this reel',
            steps: [
              {
                label: 'Looking at the reel',
                short: 'Looking at the reel',
                sources: [{ kind: 'wedded', label: 'Reels', detail: 'The reel you sent' }],
                result: 'Bright outdoor Mehndi photos, close-ups of hands',
              },
              {
                label: 'Searching Wedded for photographers with this look',
                short: 'Searching Wedded for photographers',
                sources: PHOTOGRAPHERS.map((vendor): Source => ({
                  kind: 'wedded',
                  label: 'Wedded',
                  detail: `${vendor.name} · ${vendor.city}`,
                  photo: vendor.photo,
                })),
                result: '3 photographers with this look, all free on Jun 10',
              },
            ],
          },
        },
      },
      { at: 2400, do: { op: 'step', taskId: 'reel' } },
      {
        at: 4200,
        do: { op: 'finish', taskId: 'reel', summary: 'Worked 30 sec · checked 11 pages' },
      },
      {
        at: 4500,
        do: say('Here are 3 photographers whose work looks like this. All 3 are free on June 10.'),
      },
      { at: 4900, do: { op: 'vendors', vendors: PHOTOGRAPHERS } },
    ],
  },
  compare: {
    triggers: ['compare'],
    ops: [
      {
        at: 600,
        do: say(
          "Here are the 3 dhol players side by side: price, who's free on June 12 and how fast they reply. Dhol Di Awaaz is the lowest, at $350.",
        ),
      },
      { at: 1000, do: { op: 'artifact', id: 'dhol' } },
    ],
  },
  ghori: {
    triggers: ['ghori'],
    ops: [
      { at: 600, do: say("I'll look for a ghori near Yuba City for the Baraat on June 13.") },
      {
        at: 1200,
        do: {
          op: 'task',
          task: {
            id: 'ghori',
            title: 'Finding a ghori',
            steps: [
              {
                label: 'Reading your plan',
                short: 'Reading your plan',
                sources: [
                  { kind: 'plan', label: 'Your plan', detail: 'Baraat · Sat, Jun 13 · Yuba City' },
                ],
                result: 'Baraat · Sat, Jun 13 · Yuba City',
              },
              {
                label: 'Searching Google Maps for ghori rentals',
                short: 'Searching Google Maps',
                sources: [
                  { kind: 'maps', label: 'Google Maps', detail: 'Ghori rentals near Yuba City' },
                  { kind: 'maps', label: 'Google Maps', detail: 'Wedding horses · Sacramento' },
                  { kind: 'maps', label: 'Google Maps', detail: 'Stables near Live Oak' },
                ],
                result: '2 ghori owners travel to Yuba City',
              },
            ],
          },
        },
      },
      { at: 2600, do: { op: 'step', taskId: 'ghori' } },
      {
        at: 5200,
        do: { op: 'finish', taskId: 'ghori', summary: 'Worked 30 sec · checked 6 places' },
      },
      {
        at: 5600,
        do: say(
          "I found 2 ghori owners who travel to Yuba City. Neither is on Wedded yet, so I can't check June 13 for you. Want me to find their pages so you can call them?",
        ),
      },
    ],
  },
  mehndiArtist: {
    triggers: ['mehndi artist'],
    ops: [
      { at: 600, do: say("I'll look for mehndi artists near Yuba City who are free on June 10.") },
      {
        at: 1200,
        do: {
          op: 'task',
          task: {
            id: 'mehndi',
            title: 'Finding a mehndi artist',
            steps: [
              {
                label: 'Reading your plan',
                short: 'Reading your plan',
                sources: [
                  { kind: 'plan', label: 'Your plan', detail: 'Mehndi · Jun 10 · Yuba City' },
                ],
                result: 'Mehndi · Jun 10 · Yuba City',
              },
              {
                label: 'Finding mehndi artists near Yuba City',
                short: 'Finding mehndi artists',
                sources: ['hennabyharleen', 'mehndi.by.preet', 'yubacityhenna'].map(
                  (handle): Source => ({
                    kind: 'web',
                    label: 'Pages on the web',
                    detail: `instagram.com/${handle}`,
                  }),
                ),
                result: '3 mehndi artists near Yuba City',
              },
              {
                label: "Checking who's free on Jun 10",
                short: "Checking who's free on Jun 10",
                sources: [
                  {
                    kind: 'calendar',
                    label: 'Calendar',
                    detail: '3 calendars · updated this month',
                  },
                ],
                result: '2 are free on Jun 10',
              },
            ],
          },
        },
      },
      { at: 2400, do: { op: 'step', taskId: 'mehndi' } },
      { at: 4400, do: { op: 'step', taskId: 'mehndi' } },
      {
        at: 5800,
        do: { op: 'finish', taskId: 'mehndi', summary: 'Worked 40 sec · checked 9 pages' },
      },
      {
        at: 6200,
        do: say(
          "2 mehndi artists near Yuba City are free on June 10. Want me to ask them about the bride's mehndi and the family's?",
        ),
      },
    ],
  },
  left: {
    triggers: ["what's left", 'left to book'],
    capture: /left to book for the (.+?)[.?!]*$/i,
    ops: [
      {
        at: 600,
        do: {
          op: 'task',
          task: {
            id: 'left',
            title: 'Reading your plan',
            steps: [
              {
                label: 'Reading your plan',
                short: 'Reading your plan',
                sources: [
                  { kind: 'plan', label: 'Your plan', detail: 'Mehndi · Jun 10 · 0 of 2 booked' },
                ],
                result: 'Mehndi: 0 of 2 booked',
              },
            ],
          },
        },
      },
      { at: 1800, do: { op: 'finish', taskId: 'left', summary: 'Read your plan' } },
      {
        at: 2100,
        do: say(
          "The Mehndi has 2 things left to book: a caterer and a mehndi artist. Saffron Tandoor's tasting is waiting for your OK, and I can look for a mehndi artist free on June 10.",
        ),
      },
    ],
  },
  // What's left for an event other than the Mehndi (Goals' Talk about
  // it): "{q}" is the whole answer, from EVENTS
  eventLeft: {
    triggers: [],
    ops: [
      {
        at: 600,
        do: {
          op: 'task',
          task: {
            id: 'left',
            title: 'Reading your plan',
            steps: [
              {
                label: 'Reading your plan',
                short: 'Reading your plan',
                sources: [{ kind: 'plan', label: 'Your plan', detail: 'Your events and bookings' }],
                result: 'Read every event',
              },
            ],
          },
        },
      },
      { at: 1800, do: { op: 'finish', taskId: 'left', summary: 'Read your plan' } },
      { at: 2100, do: say('{q}') },
    ],
  },
  next: {
    triggers: ['book next', 'what next', 'do next'],
    ops: [
      {
        at: 600,
        do: say(
          'Next up: a dhol player for the Jaago and a photographer for the Anand Karaj. Want me to start with the dhol player?',
        ),
      },
    ],
  },
  rest: {
    triggers: ['still need'],
    capture: /still need for the (.+?)[.?!]*$/i,
    fill: 'event',
    ops: [
      {
        at: 600,
        do: say(
          "For the {q}, I'll look for each essential you haven't booked yet, nearest and free on your date first.",
        ),
      },
      {
        at: 1200,
        do: {
          op: 'task',
          task: {
            id: 'rest',
            title: 'Finding vendors for the {q}',
            steps: [
              {
                label: 'Reading your plan',
                short: 'Reading your plan',
                sources: [
                  { kind: 'plan', label: 'Your plan', detail: '{q} · essentials not booked yet' },
                ],
                result: '{q}: 2 essentials left',
              },
              {
                label: 'Searching Wedded for the {q} essentials',
                short: 'Searching Wedded',
                sources: [...PHOTOGRAPHERS, CATERER].map((vendor): Source => ({
                  kind: 'wedded',
                  label: 'Wedded',
                  detail: `${vendor.name} · ${vendor.city}`,
                  photo: vendor.photo,
                })),
                result: 'Vendors free on your date for both',
              },
            ],
          },
        },
      },
      { at: 2600, do: { op: 'step', taskId: 'rest' } },
      {
        at: 5200,
        do: { op: 'finish', taskId: 'rest', summary: 'Worked 40 sec · checked 12 pages' },
      },
      {
        at: 5600,
        do: say(
          "For the {q}, a caterer and a photographer are left. Saffron Tandoor and Kesri Frames are both free on your date and near Yuba City. Want me to start with the caterer? You'll see the message before anything is sent.",
        ),
      },
    ],
  },
  watch: {
    triggers: ['tell me if', 'tell me when', 'let me know'],
    ops: [
      {
        at: 600,
        do: say(
          "Okay. I'll check every morning and tell you only if that changes. It's under Goals, where you can pause it.",
        ),
      },
    ],
  },
  look: {
    triggers: ['instagram', 'on the web', 'look for'],
    capture: /look (?:for|on the web for) (.+?)(?: near\b| on the\b|,|[.?!]*$)/i,
    fill: 'that',
    ops: [
      {
        at: 600,
        do: {
          op: 'task',
          task: {
            id: 'look',
            title: 'Looking for {q}',
            steps: [
              {
                label: 'Searching Wedded for {q}',
                short: 'Searching Wedded',
                sources: [{ kind: 'wedded', label: 'Wedded', detail: '{q} near Yuba City' }],
                result: 'Nothing on Wedded near Yuba City yet',
              },
              {
                label: 'Finding {q} pages on Instagram near Yuba City',
                short: 'Looking for Instagram pages',
                sources: [
                  {
                    kind: 'web',
                    label: 'Pages on the web',
                    detail: 'instagram.com · {q} Yuba City',
                  },
                  { kind: 'maps', label: 'Google Maps', detail: '{q} near Yuba City' },
                ],
                result: '2 Instagram pages that look right',
              },
            ],
          },
        },
      },
      { at: 2200, do: { op: 'step', taskId: 'look' } },
      {
        at: 4600,
        do: { op: 'finish', taskId: 'look', summary: 'Worked 40 sec · checked 9 pages' },
      },
      {
        at: 5000,
        do: say(
          "I couldn't find {q} on Wedded near Yuba City yet. I found 2 Instagram pages that look right, but I can't check their dates, so call before you count on them.",
        ),
      },
    ],
  },
  photo: {
    triggers: [],
    ops: [
      {
        at: 600,
        do: say(
          'Thanks. I saved it to Lists and photos. Want me to find vendors who can do this look for the Mehndi?',
        ),
      },
    ],
  },
  unsave: {
    triggers: [],
    ops: [{ at: 300, do: say('Okay, I took them off your Jaago list.') }],
  },
  untour: {
    triggers: [],
    ops: [{ at: 300, do: say('Okay, I took the tour off your calendar.') }],
  },
  fallback: {
    triggers: [],
    ops: [
      {
        at: 600,
        do: say('This is a preview, so I can do a few things so far. Try one of these:'),
      },
      { at: 900, do: { op: 'starters' } },
    ],
  },
};

// Earlier flows win: "Pay Royal Orchard's deposit" is the deposit, not the
// hall, and "Find a Mehndi artist free on Jun 10" isn't a date question.
const ORDER: FlowKey[] = [
  'reel',
  'compare',
  'deposit',
  'watch',
  'dhol',
  'mehndiArtist',
  'left',
  'ghori',
  'next',
  'rest',
  'hallFree',
  'hall',
  'free',
  'look',
];

const normalize = (text: string) => text.toLowerCase().replace(/[’‘]/g, "'");

/**
 * The flow a message plays: the first flow (in ORDER) with a trigger word in
 * it, then one whose trigger is in the context chip's label (a reel always
 * plays `reel`), else `fallback`. `q` is what the flow's `capture` pulled out.
 */
export function matchFlow(
  text: string,
  context?: WedContext | null,
): { flow: FlowKey; q?: string } {
  const words = normalize(text);
  const hit = ORDER.find(
    (flow) =>
      FLOWS[flow].triggers.some((w) => words.includes(w)) &&
      (FLOWS[flow].also ?? []).every((w) => words.includes(w)),
  );
  const q = hit ? FLOWS[hit].capture?.exec(text)?.[1]?.trim() : undefined;
  // What's left for another event: that event's own answer
  if (hit === 'left' && q) {
    const event = EVENTS.find((e) => e.name.toLowerCase() === q.toLowerCase());
    if (event && event.slug !== 'mehndi') return { flow: 'eventLeft', q: event.left };
  }
  if (hit) return { flow: hit, q };
  if (context?.kind === 'reel') return { flow: 'reel' };
  if (context) {
    const about = normalize(context.label);
    const near = ORDER.find(
      (flow) => !FLOWS[flow].also && FLOWS[flow].triggers.some((w) => about.includes(w)),
    );
    if (near) return { flow: near };
  }
  return { flow: 'fallback' };
}
