// Translation-resource logic with zero React/JSX dependency, split out of index.tsx so it can be
// imported directly by a plain `node --test` run (see tests/unit/i18n-completeness.test.ts) —
// index.tsx pulls in React and contains JSX, which Node's native TS type-stripping cannot parse
// outside a bundler.
import en from "./locales/en.json" with { type: "json" };
import pl from "./locales/pl.json" with { type: "json" };

export const SUPPORTED_LOCALES = ["en", "pl"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const resources: Record<Locale, typeof en> = { en, pl: pl as typeof en };

export function getByPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, segment) => {
    if (acc && typeof acc === "object" && segment in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[segment];
    }
    return undefined;
  }, obj);
}

function leafPaths(obj: unknown, prefix = ""): string[] {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    return Object.entries(obj as Record<string, unknown>).flatMap(([key, value]) =>
      leafPaths(value, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [prefix];
}

/**
 * Detects missing keys (docs/PRODUCT_VISION.md-derived requirement: "detect missing translation
 * keys, report locale completeness"). Compares every leaf key path in the English resource
 * (treated as the canonical key set) against each other locale — in both directions, so a key
 * that exists only in Polish (or only in English) is caught, not just an English-only addition.
 */
export function checkTranslationCompleteness(): Record<Locale, { missingKeys: string[] }> {
  const canonicalKeys = leafPaths(en);
  const result = {} as Record<Locale, { missingKeys: string[] }>;
  for (const locale of SUPPORTED_LOCALES) {
    const localeKeys = leafPaths(resources[locale]);
    const missingFromCanonical = canonicalKeys.filter(
      (key) => getByPath(resources[locale], key) === undefined,
    );
    const extraNotInCanonical = localeKeys.filter((key) => getByPath(en, key) === undefined);
    result[locale] = { missingKeys: [...missingFromCanonical, ...extraNotInCanonical] };
  }
  return result;
}
