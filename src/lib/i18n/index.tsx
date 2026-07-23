import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  checkTranslationCompleteness,
  getByPath,
  resources,
  SUPPORTED_LOCALES,
  type Locale,
} from "./completeness";

export { checkTranslationCompleteness, SUPPORTED_LOCALES, type Locale };

// Real i18n infrastructure (docs/PRODUCT_VISION.md "Geographic direction",
// docs/IMPLEMENTATION_PLAN.md phase 14) — deliberately hand-rolled rather than pulling in
// i18next/react-intl: only a small, demonstrated slice of the app (site header/footer/homepage)
// is actually translated so far (see the phase note in IMPLEMENTATION_PLAN.md for what's honestly
// NOT covered yet — this is a foundation, not "complete Polish and English translations" across
// the whole app), and a full library integration wasn't worth the dependency weight for that.
//
// Locale is currently client-side only (localStorage), not SSR-aware via a cookie yet — a signed-
// in visitor's very first server-rendered paint is always English, then re-renders in their saved
// language on the client. Documented as a known gap, not silently accepted as "done".
const STORAGE_KEY = "havenpaw-locale";
const FALLBACK_LOCALE: Locale = "en";

function isLocale(value: string | null): value is Locale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

function readStoredLocale(): Locale {
  if (typeof window === "undefined") return FALLBACK_LOCALE;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isLocale(stored) ? stored : FALLBACK_LOCALE;
}

type TranslateFn = (key: string) => string;

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TranslateFn;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(FALLBACK_LOCALE);

  // Read the real stored preference only after mount (localStorage doesn't exist during SSR) —
  // see the file header note on this not being SSR-locale-aware yet.
  useEffect(() => {
    setLocaleState(readStoredLocale());
  }, []);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, next);
  };

  const t = useMemo<TranslateFn>(() => {
    return (key: string) => {
      const inLocale = getByPath(resources[locale], key);
      if (typeof inLocale === "string") return inLocale;

      const inFallback = getByPath(resources[FALLBACK_LOCALE], key);
      if (typeof inFallback === "string") {
        if (import.meta.env.DEV) {
          console.warn(
            `[i18n] Missing key "${key}" for locale "${locale}", falling back to English.`,
          );
        }
        return inFallback;
      }

      if (import.meta.env.DEV) {
        console.warn(`[i18n] Missing key "${key}" in every locale.`);
      }
      return key;
    };
  }, [locale]);

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useTranslation() must be used within an I18nProvider");
  return ctx;
}

export const LOCALE_DISPLAY_NAMES: Record<Locale, string> = {
  en: "English",
  pl: "Polski",
};

export type PluralCategory = "one" | "few" | "many";

/**
 * Polish has three plural forms (1; 2–4 except 12–14; everything else), not the two English has —
 * a naive `n === 1 ? singular : plural` composition (as the original foundations count sentence
 * used) reads as ungrammatical Polish for counts like 2–4. English only has "one"/"other", so it
 * always resolves to "many" for anything but 1 — callers should give English's "few" key the same
 * value as its "many" key.
 */
export function pluralCategory(locale: Locale, n: number): PluralCategory {
  if (locale !== "pl") return n === 1 ? "one" : "many";
  if (n === 1) return "one";
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return "few";
  return "many";
}
