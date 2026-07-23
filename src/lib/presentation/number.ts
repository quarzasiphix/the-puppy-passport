import type { Locale } from "../i18n/completeness";
import { DATE_LOCALE } from "./date.ts";

// `value.toLocaleString()` with no locale argument uses the runtime's default locale — the
// server's ICU default under SSR, the visitor's browser locale under hydration. These can differ
// (a Polish-preference visitor whose browser reports "pl-PL" hydrating over a server render that
// defaulted to "en-US"), which is both a hydration mismatch risk and ignores the app's own locale
// setting entirely. Passing an explicit Intl locale tag, same as date formatting, fixes both.
export function formatNumber(
  value: number,
  locale: Locale,
  options?: Intl.NumberFormatOptions,
): string {
  return value.toLocaleString(DATE_LOCALE[locale], options);
}
