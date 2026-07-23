// Runs the app's own translation-completeness checker (src/lib/i18n/completeness.ts) as an actual
// automated check — previously it existed but was never invoked anywhere in the app or CI. Pure
// logic, no Supabase, no browser. Run with `npm run test:unit`.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkTranslationCompleteness,
  SUPPORTED_LOCALES,
} from "../../src/lib/i18n/completeness.ts";

test("translation key parity between en.json and pl.json", async (t) => {
  const report = checkTranslationCompleteness();

  for (const locale of SUPPORTED_LOCALES) {
    await t.test(`${locale}.json has no missing/extra keys relative to the other locale`, () => {
      assert.deepEqual(
        report[locale].missingKeys,
        [],
        `${locale}.json is out of sync: ${JSON.stringify(report[locale].missingKeys)}`,
      );
    });
  }
});
