import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { DEMO_ACCOUNTS, signIn, waitForDataSettled } from "./helpers";

// Automated pass filling the gap docs/POST_INTEGRATION_HARDENING_REPORT.md explicitly named as
// deferred ("a dedicated accessibility-tool pass ... weren't done in this session") -- the
// `test:e2e:a11y` npm script already existed (grep for `@a11y`) but had zero real tests behind it
// until this file. Scoped to axe-core's `wcag2a`/`wcag2aa` rule sets (the two levels a real launch
// should meet) rather than the full "best practice" ruleset, which includes subjective rules not
// appropriate to hard-fail a build on. One test per representative page type -- covering every
// individual route would be excessive; these are chosen to cover every distinct layout/component
// family (marketplace list, detail page with a hero + follow/report controls, auth form, dashboard
// shell + sidebar nav) rather than duplicating the same layout repeatedly.
test.describe("accessibility @a11y", () => {
  test("homepage has no critical/serious WCAG 2A/2AA violations", async ({ page }) => {
    await page.goto("/");
    await waitForDataSettled(page);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });

  test("find-a-dog listing has no critical/serious WCAG 2A/2AA violations", async ({ page }) => {
    await page.goto("/find-a-dog");
    await waitForDataSettled(page);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });

  test("breeder detail page (hero + follow/report controls) has no critical/serious violations", async ({
    page,
  }) => {
    await page.goto("/breeders");
    await page.locator('a[href^="/breeders/"]').first().click();
    await expect(page).toHaveURL(/\/breeders\/[^/]+$/);
    await waitForDataSettled(page);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });

  test("sign-in form has no critical/serious violations", async ({ page }) => {
    await page.goto("/signin");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });

  test("buyer dashboard (sidebar shell) has no critical/serious violations", async ({ page }) => {
    await signIn(page, DEMO_ACCOUNTS.buyer);
    await waitForDataSettled(page);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });

  test("operations dashboard (dense table-heavy layout) has no critical/serious violations", async ({
    page,
  }) => {
    await signIn(page, DEMO_ACCOUNTS.ops);
    await waitForDataSettled(page);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });
});
