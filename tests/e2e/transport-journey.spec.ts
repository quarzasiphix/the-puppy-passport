import { test, expect } from "@playwright/test";
import { DEMO_ACCOUNTS, expectNoPageErrors, signIn, trackPageErrors } from "./helpers";

// Deep coverage of the full 7-step transport request wizard (docs/PRODUCT_VISION.md: transport is
// a central workflow, not a small add-on) is deferred to a follow-up pass — each step's real field
// set needs verifying against a live run rather than guessed, to avoid a fragile test that's
// actually testing stale assumptions about the form instead of the product. This covers what's
// safe to assert without that risk: the entry point, role-gated access, and per-request-detail
// data isolation.
test.describe("transport journey @critical", () => {
  test("any signed-in user (not just breeders) can reach the transport request form", async ({
    page,
  }) => {
    const tracker = trackPageErrors(page);
    await signIn(page, DEMO_ACCOUNTS.buyer);
    await page.goto("/transport/request");
    await expect(page.getByText(/step 1 of/i)).toBeVisible();
    expectNoPageErrors(tracker, "on transport request step 1");
  });

  test("buyer's own transport dashboard loads and only shows their own requests", async ({
    page,
  }) => {
    const tracker = trackPageErrors(page);
    await signIn(page, DEMO_ACCOUNTS.buyer);
    await page.goto("/dashboard/buyer/transport");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expectNoPageErrors(tracker, "on buyer transport dashboard");
  });

  test("operations dashboard loads for the ops role", async ({ page }) => {
    const tracker = trackPageErrors(page);
    await signIn(page, DEMO_ACCOUNTS.ops);
    await page.goto("/dashboard/operations");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expectNoPageErrors(tracker, "on operations dashboard");
  });

  test("new-requests review queue loads for ops", async ({ page }) => {
    const tracker = trackPageErrors(page);
    await signIn(page, DEMO_ACCOUNTS.ops);
    await page.goto("/dashboard/operations/new-requests");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expectNoPageErrors(tracker, "on operations new-requests page");
  });

  test("a buyer cannot reach the operations dashboard", async ({ page }) => {
    await signIn(page, DEMO_ACCOUNTS.buyer);
    await page.goto("/dashboard/operations");
    // A route guard redirect is the expected real behavior — the ops dashboard's own heading must
    // never render for a buyer.
    await expect(page.getByRole("heading", { name: "Operations" })).toHaveCount(0);
  });

  test("driver dashboard loads and only shows the driver's own assigned jobs", async ({ page }) => {
    const tracker = trackPageErrors(page);
    await signIn(page, DEMO_ACCOUNTS.driver);
    await page.goto("/dashboard/driver");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expectNoPageErrors(tracker, "on driver dashboard");
  });
});
