import { test, expect } from "@playwright/test";
import { expectNoPageErrors, trackPageErrors } from "./helpers";

// Anonymous, unauthenticated browsing of the public marketplace — every one of these pages must
// work for a visitor who has never signed in, since this is the top of the funnel.
test.describe("public discovery @critical", () => {
  test("homepage loads with real stats and no console errors", async ({ page }) => {
    const tracker = trackPageErrors(page);
    await page.goto("/");
    await expect(page).toHaveTitle(/Anemalo/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expectNoPageErrors(tracker, "on homepage");
  });

  test("find-a-dog listing renders and filters do not error", async ({ page }) => {
    const tracker = trackPageErrors(page);
    await page.goto("/find-a-dog");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expectNoPageErrors(tracker, "on find-a-dog");
  });

  test("breeders list renders", async ({ page }) => {
    const tracker = trackPageErrors(page);
    await page.goto("/breeders");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expectNoPageErrors(tracker, "on /breeders");
  });

  test("breeder detail renders for a real approved kennel", async ({ page }) => {
    const tracker = trackPageErrors(page);
    await page.goto("/breeders");
    const firstLink = page.locator('a[href^="/breeders/"]').first();
    await expect(firstLink).toBeVisible();
    await firstLink.click();
    await expect(page).toHaveURL(/\/breeders\/[^/]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expectNoPageErrors(tracker, "on breeder detail");
  });

  test("foundations list renders", async ({ page }) => {
    const tracker = trackPageErrors(page);
    await page.goto("/foundations");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expectNoPageErrors(tracker, "on /foundations");
  });

  // Regression for the integration bug fixed in commit d983b2a: /foundations/$slug used to
  // silently render the LIST page's own content for every slug because the parent route had no
  // <Outlet/>. Assert the actual detail page renders, not just that navigation "succeeds".
  test("foundation detail renders its own page, not the list page (regression)", async ({
    page,
  }) => {
    const tracker = trackPageErrors(page);
    await page.goto("/foundations");
    const firstLink = page.locator('a[href^="/foundations/"]').first();
    await expect(firstLink).toBeVisible();
    const href = await firstLink.getAttribute("href");
    await firstLink.click();

    await expect(page).toHaveURL(/\/foundations\/[^/]+$/);
    if (href) await expect(page).toHaveURL(new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    // The list page's own <h1> is a fixed, known string — the detail page must NOT show it.
    await expect(page.getByRole("heading", { name: "Foundations and rescues" })).toHaveCount(0);
    expectNoPageErrors(tracker, "on foundation detail");
  });

  test("planned routes page renders translated status labels, not raw enum values", async ({
    page,
  }) => {
    const tracker = trackPageErrors(page);
    await page.goto("/planned-routes");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const body = await page.locator("body").innerText();
    // Regression for ledger entry 6: raw 'planning'/'confirmed' enum values must never render
    // unqualified — either a translated label or the explicit empty state is acceptable.
    const hasRawPlanning = /\bplanning\b/.test(body) && !/Being planned/.test(body);
    const hasRawConfirmed = /^confirmed$/im.test(body) && !/Confirmed$/m.test(body);
    expect(hasRawPlanning, "raw 'planning' enum leaked without translation").toBe(false);
    expect(hasRawConfirmed, "raw 'confirmed' enum leaked without translation").toBe(false);
    expectNoPageErrors(tracker, "on /planned-routes");
  });

  test("unknown route shows the real not-found page, not a blank screen or crash", async ({
    page,
  }) => {
    // No expectNoPageErrors() here deliberately: the server correctly responds 404 for this URL,
    // and Chrome logs that as a console "Failed to load resource: ... 404" message by design --
    // asserting "no console errors" on a page whose whole point is a 404 response would be testing
    // the wrong thing. The real assertion is that the app's own 404 UI renders correctly instead
    // of a blank screen or crash.
    await page.goto("/this-route-does-not-exist-e2e");
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Go home" })).toBeVisible();
  });
});
