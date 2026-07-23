// Pure logic tests — no Supabase, no browser, no network. Run with `npm run test:unit`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatNumber } from "../../src/lib/presentation/number.ts";

test("formatNumber", async (t) => {
  await t.test("formats using the English locale tag for 'en'", () => {
    assert.equal(formatNumber(1234, "en"), (1234).toLocaleString("en-GB"));
  });

  await t.test("formats using the Polish locale tag for 'pl'", () => {
    assert.equal(formatNumber(1234, "pl"), (1234).toLocaleString("pl-PL"));
  });

  await t.test("passes through Intl.NumberFormat options", () => {
    const options: Intl.NumberFormatOptions = { maximumFractionDigits: 0 };
    assert.equal(formatNumber(1234.5, "en", options), (1234.5).toLocaleString("en-GB", options));
  });
});
