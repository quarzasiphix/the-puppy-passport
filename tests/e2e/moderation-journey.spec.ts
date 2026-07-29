import { test, expect } from "@playwright/test";
import { DEMO_ACCOUNTS, expectNoPageErrors, signIn, trackPageErrors } from "./helpers";

// Support cases have zero frontend UI today (confirmed by docs/FEATURE_LAUNCH_MATRIX.md and
// docs/BETA_SCOPE.md — real and tested at the DB layer, but no route/component anywhere in src/
// references them). No support UI test exists here because there is nothing to test; see
// docs/POST_INTEGRATION_HARDENING_REPORT.md for this open gap.
test.describe("moderation journey @critical", () => {
  test("admin moderation queue loads for the admin role", async ({ page }) => {
    const tracker = trackPageErrors(page);
    await signIn(page, DEMO_ACCOUNTS.admin);
    await page.goto("/dashboard/admin/moderation");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expectNoPageErrors(tracker, "on admin moderation page");
  });

  test("a buyer cannot reach the admin moderation queue", async ({ page }) => {
    await signIn(page, DEMO_ACCOUNTS.buyer);
    await page.goto("/dashboard/admin/moderation");
    await expect(page.getByRole("heading", { name: "Moderation" })).toHaveCount(0);
  });

  test("breeder verification queue loads for admin", async ({ page }) => {
    const tracker = trackPageErrors(page);
    await signIn(page, DEMO_ACCOUNTS.admin);
    await page.goto("/dashboard/admin/breeder-verification");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expectNoPageErrors(tracker, "on breeder-verification page");
  });

  test("reporting a breeder from their profile opens a real dialog with reason options", async ({
    page,
  }) => {
    await signIn(page, DEMO_ACCOUNTS.buyer);
    await page.goto("/breeders");
    await page.locator('a[href^="/breeders/"]').first().click();
    await expect(page).toHaveURL(/\/breeders\/[^/]+$/);

    await page
      .getByRole("button", { name: /report/i })
      .first()
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/reason/i)).toBeVisible();
  });
});
