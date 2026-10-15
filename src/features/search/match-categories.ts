import type { LocalizedText } from '@/i18n/localized';

type Searchable = { name: LocalizedText; aliases: string[] };

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

const WORD_BREAK = /[\s/,+()&.'-]+/;

function words(text: string): string[] {
  return text.split(WORD_BREAK).filter(Boolean);
}

/** Letters to add, remove or change to turn a into b (Levenshtein), counting characters, not UTF-16 units. */
export function editDistance(a: string, b: string): number {
  const x = [...a];
  const y = [...b];
  let previous = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= y.length; j += 1) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[y.length];
}

/**
 * The typo fallback, the same rule as search_vendors on the server: every
 * typed word starts a word of the category, or is within 1 edit of one (4 to
 * 5 letters) or 2 (6 or more). Shorter words must match exactly.
 */
function closeSpelling(termWords: string[], query: string): boolean {
  const queryWords = words(query);
  return (
    queryWords.length > 0 &&
    queryWords.every((q) => {
      const length = [...q].length;
      const allowed = length >= 6 ? 2 : length >= 4 ? 1 : 0;
      return termWords.some(
        (word) => word.startsWith(q) || (allowed > 0 && editDistance(q, word) <= allowed),
      );
    })
  );
}

/** 0 is the best match; null means no match. */
function score(term: string, query: string): number | null {
  if (term === query) return 0;
  if (term.startsWith(query)) return 1;
  if (words(term).some((word) => word.startsWith(query))) return 2;
  if (term.includes(query)) return 3;
  return null;
}

/**
 * Categories whose name or aliases match what was typed, best matches first:
 * exact, then starts with, then a word that starts with, then contains. It
 * ignores case and extra spaces. Empty text matches nothing. Only when
 * nothing matches does it try close spellings ("dhool", "photgrapher").
 */
export function matchCategories<T extends Searchable>(categories: T[], text: string): T[] {
  const query = normalize(text);
  if (!query) return [];

  const scored: { category: T; best: number }[] = [];
  for (const category of categories) {
    const terms = [category.name.en, ...category.aliases].map(normalize).filter(Boolean);
    let best: number | null = null;
    for (const term of terms) {
      const s = score(term, query);
      if (s !== null && (best === null || s < best)) best = s;
    }
    if (best !== null) scored.push({ category, best });
  }
  if (scored.length === 0) {
    for (const category of categories) {
      const termWords = [category.name.en, ...category.aliases].flatMap((term) =>
        words(normalize(term)),
      );
      if (closeSpelling(termWords, query)) scored.push({ category, best: 4 });
    }
  }
  return scored
    .sort((a, b) => a.best - b.best || a.category.name.en.localeCompare(b.category.name.en, 'en'))
    .map(({ category }) => category);
}
