import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import en from "./locales/en.json";
import pl from "./locales/pl.json";

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
export const SUPPORTED_LOCALES = ["en", "pl"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

const resources: Record<Locale, typeof en> = { en, pl: pl as typeof en };

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

function getByPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, segment) => {
    if (acc && typeof acc === "object" && segment in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[segment];
    }
    return undefined;
  }, obj);
}

/**
 * Detects missing keys (docs/PRODUCT_VISION.md-derived requirement: "detect missing translation
 * keys, report locale completeness"). Compares every leaf key path in the English resource
 * (treated as the canonical key set) against each other locale, so a new English string added
 * without its Polish counterpart shows up here instead of silently rendering in the wrong
 * language.
 */
export function checkTranslationCompleteness(): Record<Locale, { missingKeys: string[] }> {
  function leafPaths(obj: unknown, prefix = ""): string[] {
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      return Object.entries(obj as Record<string, unknown>).flatMap(([key, value]) =>
        leafPaths(value, prefix ? `${prefix}.${key}` : key),
      );
    }
    return [prefix];
  }

  const canonicalKeys = leafPaths(en);
  const result = {} as Record<Locale, { missingKeys: string[] }>;
  for (const locale of SUPPORTED_LOCALES) {
    const missingKeys = canonicalKeys.filter(
      (key) => getByPath(resources[locale], key) === undefined,
    );
    result[locale] = { missingKeys };
  }
  return result;
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
