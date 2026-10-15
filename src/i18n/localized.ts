/**
 * A name or label that comes from the database (events, categories, and so
 * on), stored as {"en": "…"} so another language can be added later.
 */
export type LocalizedText = { en: string };

/**
 * A jsonb value from the database as LocalizedText, or null if it isn't one
 * (a missing optional column, or a malformed row that shouldn't crash a screen).
 */
export function asLocalizedText(value: unknown): LocalizedText | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  const { en } = value as Record<string, unknown>;
  return typeof en === 'string' ? { en } : null;
}

/** The text to show for a database name. */
export function localized(text: LocalizedText): string {
  return text.en;
}
