// Pure logic tests — no Supabase, no browser, no network. Run with `npm run test:unit`.
// A Polish-preference visitor's dates were silently rendered with an "en-GB" Intl locale at every
// call site across the app — this module is the single place that maps the app's bare "en"/"pl"
// locale code to a real Intl locale tag, so a fix here fixes every call site at once.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DATE_LOCALE, formatDate, formatDateTime } from "../../src/lib/presentation/date.ts";

test("DATE_LOCALE", async (t) => {
  await t.test("maps the app's bare locale codes to real Intl locale tags", () => {
    assert.equal(DATE_LOCALE.en, "en-GB");
    assert.equal(DATE_LOCALE.pl, "pl-PL");
  });
});

test("formatDate", async (t) => {
  const date = "2026-03-05T00:00:00.000Z";

  await t.test("formats using the English locale tag for 'en'", () => {
    assert.equal(formatDate(date, "en"), new Date(date).toLocaleDateString("en-GB"));
  });

  await t.test("formats using the Polish locale tag for 'pl'", () => {
    assert.equal(formatDate(date, "pl"), new Date(date).toLocaleDateString("pl-PL"));
  });

  await t.test("passes through Intl.DateTimeFormat options", () => {
    const options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
    assert.equal(
      formatDate(date, "en", options),
      new Date(date).toLocaleDateString("en-GB", options),
    );
  });
});

test("formatDateTime", async (t) => {
  const date = "2026-03-05T14:30:00.000Z";

  await t.test("formats a full date+time using the Polish locale tag for 'pl'", () => {
    assert.equal(formatDateTime(date, "pl"), new Date(date).toLocaleString("pl-PL"));
  });
});
