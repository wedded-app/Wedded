/**
 * The designs a family picks for their wedding website (DECISIONS.md,
 * 2026-10-22). Each is kept clean on purpose: lots of space, one motif and
 * one accent, never glitter or gold gradients. The names are plain English
 * any family can use. A design's colours are its own, the same in light and
 * dark mode, because the page is the family's, not the app's.
 *
 * The database keeps only the ids (wedding_sites.design and palette), so a
 * new design is a new entry here.
 */

/** How the cover is laid out, and the one drawing it uses. */
export type CoverStyle =
  | 'photo' // Classic: the photo fills the cover, the names over it
  | 'bands' // Heirloom: embroidered bands above and below
  | 'arch' // Palace: the photo inside a fine arch
  | 'garland' // Marigold: strings of marigolds across the top
  | 'stars' // Noor: midnight, gold stars, the names inside an arch
  | 'corners'; // Mehndi: henna line-work in two corners

export type SitePalette = {
  id: string;
  /** i18n key under website.palettes */
  nameKey: string;
  /** The page. */
  paper: string;
  /** Text and names. */
  ink: string;
  /** Second lines; at least 4.5:1 on paper. */
  soft: string;
  /** The design's one accent: rules, small capitals, the drawing. */
  accent: string;
  /** The drawing's second colour. */
  accent2: string;
  /** Cards (events, hotels) on the page. */
  card: string;
  /** Hairlines. */
  line: string;
  /** Text on the ink-filled button (paper, unless that's too faint). */
  onInk: string;
};

export type SiteDesign = {
  id: string;
  /** i18n key under website.designs */
  nameKey: string;
  /** One line about it, under website.designNotes */
  noteKey: string;
  cover: CoverStyle;
  /** The couple's names; may be a script. */
  namesFont: string;
  /** Headings and event names: always an easy-to-read serif. */
  headingFont: string;
  /** Script and wide capitals need different sizes to look the same. */
  namesScale: number;
  headingScale: number;
  /** Small capitals over sections ("YOUR EVENTS"), spaced out. */
  capsFont: string;
  palettes: SitePalette[];
};

const FRAUNCES = 'Fraunces_500Medium';
const CORMORANT = 'CormorantGaramond_600SemiBold';
const CINZEL = 'Cinzel_500Medium';
const PINYON = 'PinyonScript_400Regular';
const CAPS = 'PlusJakartaSans_600SemiBold';

export const SITE_DESIGNS: SiteDesign[] = [
  {
    id: 'classic',
    nameKey: 'website.designs.classic',
    noteKey: 'website.designNotes.classic',
    cover: 'photo',
    namesFont: FRAUNCES,
    headingFont: FRAUNCES,
    namesScale: 1,
    headingScale: 1,
    capsFont: CAPS,
    palettes: [
      {
        id: 'ink',
        nameKey: 'website.palettes.ink',
        paper: '#FFFFFF',
        ink: '#141214',
        soft: '#5F585C',
        accent: '#8A1C30',
        accent2: '#141214',
        card: '#F7F6F4',
        line: '#E7E3E0',
        onInk: '#FFFFFF',
      },
      {
        id: 'blush',
        nameKey: 'website.palettes.blush',
        paper: '#FFF8F6',
        ink: '#3A1F24',
        soft: '#6E5357',
        accent: '#B4335C',
        accent2: '#E9B8C2',
        card: '#FBEDEE',
        line: '#F1DADF',
        onInk: '#FFFFFF',
      },
      {
        id: 'sage',
        nameKey: 'website.palettes.sage',
        paper: '#F7F8F3',
        ink: '#1F2A22',
        soft: '#535F55',
        accent: '#4E7A57',
        accent2: '#A9BFA4',
        card: '#EEF1E8',
        line: '#DDE3D6',
        onInk: '#FFFFFF',
      },
    ],
  },
  {
    id: 'heirloom',
    nameKey: 'website.designs.heirloom',
    noteKey: 'website.designNotes.heirloom',
    cover: 'bands',
    namesFont: CORMORANT,
    headingFont: CORMORANT,
    namesScale: 1.12,
    headingScale: 1.1,
    capsFont: CAPS,
    palettes: [
      {
        id: 'maroon',
        nameKey: 'website.palettes.maroon',
        paper: '#FBF4E6',
        ink: '#4A0E1B',
        soft: '#6E4334',
        accent: '#D99A13',
        accent2: '#B3122E',
        card: '#F4E7CD',
        line: '#E8D6B4',
        onInk: '#FBF4E6',
      },
      {
        id: 'red',
        nameKey: 'website.palettes.red',
        paper: '#FFF6EC',
        ink: '#5A1A10',
        soft: '#7A4A37',
        accent: '#F0A030',
        accent2: '#C4271B',
        card: '#FBE9D6',
        line: '#F0D9BE',
        onInk: '#FFF6EC',
      },
      {
        id: 'emerald',
        nameKey: 'website.palettes.emerald',
        paper: '#F5F7F1',
        ink: '#133A2C',
        soft: '#465F53',
        accent: '#D9A740',
        accent2: '#1F6B4F',
        card: '#E8EFE6',
        line: '#D3DFD2',
        onInk: '#F5F7F1',
      },
    ],
  },
  {
    id: 'palace',
    nameKey: 'website.designs.palace',
    noteKey: 'website.designNotes.palace',
    cover: 'arch',
    namesFont: CINZEL,
    headingFont: CINZEL,
    namesScale: 0.78,
    headingScale: 0.8,
    capsFont: CAPS,
    palettes: [
      {
        id: 'ivory',
        nameKey: 'website.palettes.ivory',
        paper: '#F7F1E6',
        ink: '#2A2220',
        soft: '#62544B',
        accent: '#A8843C',
        accent2: '#7B2D26',
        card: '#EFE6D6',
        line: '#E2D5BF',
        onInk: '#F7F1E6',
      },
      {
        id: 'emerald',
        nameKey: 'website.palettes.emerald',
        paper: '#F1F4EF',
        ink: '#16302A',
        soft: '#4A5E56',
        accent: '#B08D45',
        accent2: '#24594A',
        card: '#E4EBE3',
        line: '#D0DCD2',
        onInk: '#F1F4EF',
      },
      {
        id: 'rose',
        nameKey: 'website.palettes.rose',
        paper: '#FBF3F2',
        ink: '#3B1E22',
        soft: '#6E5255',
        accent: '#B07A5A',
        accent2: '#9E3A4E',
        card: '#F4E5E4',
        line: '#EBD3D3',
        onInk: '#FBF3F2',
      },
    ],
  },
  {
    id: 'marigold',
    nameKey: 'website.designs.marigold',
    noteKey: 'website.designNotes.marigold',
    cover: 'garland',
    namesFont: PINYON,
    headingFont: CORMORANT,
    namesScale: 1.3,
    headingScale: 1.1,
    capsFont: CAPS,
    palettes: [
      {
        id: 'marigold',
        nameKey: 'website.palettes.marigold',
        paper: '#FFF7E8',
        ink: '#3B2610',
        soft: '#6B4E2B',
        accent: '#EE7F00',
        accent2: '#F5C010',
        card: '#FCEACB',
        line: '#F1DDB5',
        onInk: '#FFF7E8',
      },
      {
        id: 'pink',
        nameKey: 'website.palettes.pink',
        paper: '#FFF6F4',
        ink: '#3E1530',
        soft: '#6E4A5C',
        accent: '#F08A00',
        accent2: '#D6246E',
        card: '#FCE6EC',
        line: '#F2D1DD',
        onInk: '#FFF6F4',
      },
      {
        id: 'haldi',
        nameKey: 'website.palettes.haldi',
        paper: '#FFFBEA',
        ink: '#3A2E06',
        soft: '#665A2C',
        accent: '#E58E1A',
        accent2: '#F2C230',
        card: '#FBF1C9',
        line: '#F0E3A6',
        onInk: '#FFFBEA',
      },
    ],
  },
  {
    id: 'noor',
    nameKey: 'website.designs.noor',
    noteKey: 'website.designNotes.noor',
    cover: 'stars',
    namesFont: CINZEL,
    headingFont: CINZEL,
    namesScale: 0.8,
    headingScale: 0.8,
    capsFont: CAPS,
    palettes: [
      {
        id: 'midnight',
        nameKey: 'website.palettes.midnight',
        paper: '#0F1A33',
        ink: '#F3E8D0',
        soft: '#C3B89F',
        accent: '#CDA85E',
        accent2: '#CDA85E',
        card: '#17244A',
        line: '#2A3964',
        onInk: '#0F1A33',
      },
      {
        id: 'plum',
        nameKey: 'website.palettes.plum',
        paper: '#1E0F1F',
        ink: '#F3E3E6',
        soft: '#C4AEB3',
        accent: '#D8A657',
        accent2: '#D8A657',
        card: '#2B1830',
        line: '#3E2945',
        onInk: '#1E0F1F',
      },
      {
        id: 'forest',
        nameKey: 'website.palettes.forest',
        paper: '#0C2620',
        ink: '#EFE8D6',
        soft: '#B5BFAE',
        accent: '#CFAE62',
        accent2: '#CFAE62',
        card: '#12352D',
        line: '#22493F',
        onInk: '#0C2620',
      },
    ],
  },
  {
    id: 'mehndi',
    nameKey: 'website.designs.mehndi',
    noteKey: 'website.designNotes.mehndi',
    cover: 'corners',
    namesFont: PINYON,
    headingFont: CORMORANT,
    namesScale: 1.3,
    headingScale: 1.1,
    capsFont: CAPS,
    palettes: [
      {
        id: 'henna',
        nameKey: 'website.palettes.henna',
        paper: '#F7EFE5',
        ink: '#53291A',
        soft: '#76503D',
        accent: '#9A4A2A',
        accent2: '#C27B4A',
        card: '#F0E2D2',
        line: '#E6D3BE',
        onInk: '#F7EFE5',
      },
      {
        id: 'green',
        nameKey: 'website.palettes.green',
        paper: '#F4F5EC',
        ink: '#2E3A1C',
        soft: '#5A6444',
        accent: '#5E7A2E',
        accent2: '#A7B86A',
        card: '#E9ECD9',
        line: '#D9DFC1',
        onInk: '#F4F5EC',
      },
      {
        id: 'rose',
        nameKey: 'website.palettes.rose',
        paper: '#FAF0EE',
        ink: '#4A2228',
        soft: '#755257',
        accent: '#A3485A',
        accent2: '#D49AA4',
        card: '#F3E1E0',
        line: '#EACFD0',
        onInk: '#FAF0EE',
      },
    ],
  },
];

/** A design by id; Classic for one the app doesn't know (an older app, a typo). */
export function siteDesign(id: string | null | undefined): SiteDesign {
  return SITE_DESIGNS.find((d) => d.id === id) ?? SITE_DESIGNS[0];
}

/** A design's colours by id; its first set when null or unknown. */
export function sitePalette(design: SiteDesign, id: string | null | undefined): SitePalette {
  return design.palettes.find((p) => p.id === id) ?? design.palettes[0];
}

/**
 * Colours a family can give an event's dress code, as swatches guests see
 * next to "What to wear". Named so screen readers say them.
 */
export const DRESS_COLORS: { hex: string; nameKey: string }[] = [
  { hex: '#F2C230', nameKey: 'website.colors.yellow' },
  { hex: '#F08A00', nameKey: 'website.colors.orange' },
  { hex: '#C4271B', nameKey: 'website.colors.red' },
  { hex: '#8A1C30', nameKey: 'website.colors.maroon' },
  { hex: '#E46C9A', nameKey: 'website.colors.pink' },
  { hex: '#7B3FA0', nameKey: 'website.colors.purple' },
  { hex: '#1F3B6E', nameKey: 'website.colors.navy' },
  { hex: '#2F7FB8', nameKey: 'website.colors.blue' },
  { hex: '#0E5C4A', nameKey: 'website.colors.emerald' },
  { hex: '#4E8A4B', nameKey: 'website.colors.green' },
  { hex: '#D9B26A', nameKey: 'website.colors.gold' },
  { hex: '#F4EDE1', nameKey: 'website.colors.ivory' },
  { hex: '#9AA0A6', nameKey: 'website.colors.silver' },
  { hex: '#141214', nameKey: 'website.colors.black' },
];

/** The i18n key naming a swatch, or null for one the list doesn't have. */
export function dressColorName(hex: string): string | null {
  return DRESS_COLORS.find((c) => c.hex === hex.toUpperCase())?.nameKey ?? null;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast between two #RRGGBB colours. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * The colour for the small capitals over each part: the accent when it reads
 * well on the page (4.5:1, for elders), else the drawing's second colour,
 * else the soft text colour. Gold on cream is lovely as a drawing but too
 * faint for small words.
 */
export function capsColor(palette: SitePalette): string {
  return (
    [palette.accent, palette.accent2].find((c) => contrast(c, palette.paper) >= 4.5) ?? palette.soft
  );
}
