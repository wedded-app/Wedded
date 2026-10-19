import { I18n } from 'i18n-js';

import en from './en.json';

// English only since 2026-10-15 (DECISIONS.md). Another language comes back
// as a second strings file here and a key in the database's names.
export const i18n = new I18n({ en });
i18n.defaultLocale = 'en';
i18n.locale = 'en';
