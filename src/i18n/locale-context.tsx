import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { i18n } from './index';

type TranslateOptions = Record<string, string | number>;

type LocaleContextValue = {
  t: (key: string, options?: TranslateOptions) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const value = useMemo<LocaleContextValue>(
    () => ({ t: (key, options) => i18n.t(key, options) }),
    [],
  );
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/** The app's words (src/i18n/en.json). */
export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used inside LocaleProvider');
  }
  return context;
}
