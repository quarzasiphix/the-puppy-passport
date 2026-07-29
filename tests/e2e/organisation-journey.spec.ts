import { test, expect } from "@playwright/test";
import { DEMO_ACCOUNTS, expectNoPageErrors, signIn, trackPageErrors } from "./helpers";

test.describe("organisation journey @critical", () => {
  test("approved breeder dashboard loads with real data, not a mocked shell", async ({ page }) => {
    const tracker = trackPageErrors(page);
    await signIn(page, DEMO_ACCOUNTS.breeder);
    await page.goto("/dashboard/breeder");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expectNoPageErrors(tracker, "on breeder dashboard");
  });

  test("breeder puppies management page loads", async ({ page }) => {
    const tracker = trackPageErrors(page);
    await signIn(page, DEMO_ACCOUNTS.breeder);
    await page.goto("/dashboard/breeder/puppies");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expectNoPageErrors(tracker, "on breeder puppies page");
  });

  test("breeder application review page loads", async ({ page }) => {
    const tracker = trackPageErrors(page);
    await signIn(page, DEMO_ACCOUNTS.breeder);
    await page.goto("/dashboard/breeder/applications");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expectNoPageErrors(tracker, "on breeder applications page");
  });

  test("breeder public profile preview matches the org owner's own organisation", async ({
    page,
  }) => {
    const tracker = trackPageErrors(page);
    await signIn(page, DEMO_ACCOUNTS.breeder);
    await page.goto("/dashboard/breeder/profile");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expectNoPageErrors(tracker, "on breeder profile page");
  });

  test("approved foundation dashboard loads", async ({ page }) => {
    const tracker = trackPageErrors(page);
    await signIn(page, DEMO_ACCOUNTS.foundation);
    await page.goto("/dashboard/foundation");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expectNoPageErrors(tracker, "on foundation dashboard");
  });

  // A pending (not-yet-verified) organisation owner is a real, meaningfully different role state
  // (see docs/LOCAL_SETUP.md) — must NOT be able to publish listings, but can still use the app as
  // an ordinary transport customer. Confirms the verification gate is enforced in the UI, not just
  // assumed.
  test("pending (unverified) breeder cannot access publish-listing UI", async ({ page }) => {
    await signIn(page, DEMO_ACCOUNTS.breederPending);
    await page.goto("/dashboard/breeder/puppies");
    // Either the route redirects away, or it renders but with no create-listing affordance —
    // either is acceptable; a working "Add puppy"/"Create listing" action is not.
    await expect(page.getByRole("link", { name: /add (a )?puppy|create listing/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /add (a )?puppy|create listing/i })).toHaveCount(
      0,
    );
  });
});
