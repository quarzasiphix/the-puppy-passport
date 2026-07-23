// Pure logic tests — no Supabase, no browser, no network. Run with `npm run test:unit`.
// Polish has three plural forms (1; 2-4 except 12-14; everything else), not the two English has -
// this exercises pluralCategory() against the specific counts that distinguish the three forms,
// including the 12-14 exception that's easy to get wrong.
import { test } from "node:test";
import assert from "node:assert/strict";
import { pluralCategory } from "../../src/lib/i18n/completeness.ts";

test("pluralCategory for English (only 'one' and 'many' are ever used)", async (t) => {
  await t.test("1 is 'one'", () => {
    assert.equal(pluralCategory("en", 1), "one");
  });
  await t.test("0, 2 and 5 are all 'many'", () => {
    assert.equal(pluralCategory("en", 0), "many");
    assert.equal(pluralCategory("en", 2), "many");
    assert.equal(pluralCategory("en", 5), "many");
  });
});

test("pluralCategory for Polish", async (t) => {
  await t.test("1 is 'one'", () => {
    assert.equal(pluralCategory("pl", 1), "one");
  });

  await t.test("2, 3 and 4 are 'few'", () => {
    assert.equal(pluralCategory("pl", 2), "few");
    assert.equal(pluralCategory("pl", 3), "few");
    assert.equal(pluralCategory("pl", 4), "few");
  });

  await t.test("0, 5-11 and 15+ are 'many'", () => {
    assert.equal(pluralCategory("pl", 0), "many");
    assert.equal(pluralCategory("pl", 5), "many");
    assert.equal(pluralCategory("pl", 11), "many");
    assert.equal(pluralCategory("pl", 15), "many");
  });

  await t.test("12, 13 and 14 are 'many', not 'few', despite ending in 2/3/4", () => {
    // The exception that's easy to get wrong: mod-10 alone would suggest "few" for 12/13/14 (since
    // 12 % 10 === 2, etc.), but Polish grammar treats the whole 12-14 range as "many".
    assert.equal(pluralCategory("pl", 12), "many");
    assert.equal(pluralCategory("pl", 13), "many");
    assert.equal(pluralCategory("pl", 14), "many");
  });

  await t.test("22, 23 and 24 are 'few' again, since they don't fall in 12-14", () => {
    assert.equal(pluralCategory("pl", 22), "few");
    assert.equal(pluralCategory("pl", 23), "few");
    assert.equal(pluralCategory("pl", 24), "few");
  });
});
