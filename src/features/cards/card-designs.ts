import { fromDateString } from '@/features/inquiry/inquiry-helpers';

/**
 * The looks a family can give an invitation card. These are print colours,
 * not app colours: a card looks the same in dark mode and once it's saved
 * as a picture, so they don't come from the theme.
 */
export type CardDesign = {
  id: string;
  /** Key under cards.designs in en.json. */
  nameKey: string;
  paper: string;
  ink: string;
  accent: string;
};

export const CARD_DESIGNS: CardDesign[] = [
  {
    id: 'ivory',
    nameKey: 'cards.designs.ivory',
    paper: '#FBF6EC',
    ink: '#4A2E1F',
    accent: '#A9792B',
  },
  {
    id: 'maroon',
    nameKey: 'cards.designs.maroon',
    paper: '#5B1424',
    ink: '#F6E7C8',
    accent: '#D9B36C',
  },
  {
    id: 'garden',
    nameKey: 'cards.designs.garden',
    paper: '#F1F3EC',
    ink: '#2F4A3A',
    accent: '#6F8F6B',
  },
  {
    id: 'night',
    nameKey: 'cards.designs.night',
    paper: '#14213D',
    ink: '#F4EFE6',
    accent: '#C9A45C',
  },
  {
    id: 'blush',
    nameKey: 'cards.designs.blush',
    paper: '#FBEDEB',
    ink: '#5A2A33',
    accent: '#C2707C',
  },
];

/** What a card says. Empty lines are left off the card. */
export type CardText = {
  opening: string;
  names: string;
  invite: string;
  event: string;
  /** yyyy-mm-dd, or null when not picked yet. */
  date: string | null;
  time: string;
  venue: string;
  note: string;
};

/** "Saturday, November 14, 2026", from the plan's yyyy-mm-dd without shifting the day. */
export function cardDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(fromDateString(value));
}

/** A page with the card in the middle at 5 by 7 inches. */
export function cardPageHtml(base64: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@page { margin: 0.5in; }
html, body { margin: 0; height: 100%; }
body { display: flex; align-items: center; justify-content: center; }
img { width: 5in; height: 7in; }
</style></head><body><img src="data:image/png;base64,${base64}" alt=""></body></html>`;
}
