import type { Locale } from "../i18n/completeness";

// Bare app locale codes ("en"/"pl") are not valid Intl locale tags on their own for regional
// formatting conventions — map each to a concrete tag once here instead of hardcoding "en-GB" at
// every call site (which silently ignored a Polish-preference visitor's locale).
export const DATE_LOCALE: Record<Locale, string> = { en: "en-GB", pl: "pl-PL" };

export function formatDate(
  date: string | number | Date,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Date(date).toLocaleDateString(DATE_LOCALE[locale], options);
}

export function formatDateTime(date: string | number | Date, locale: Locale): string {
  return new Date(date).toLocaleString(DATE_LOCALE[locale]);
}
