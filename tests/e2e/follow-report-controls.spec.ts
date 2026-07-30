import { test, expect } from "@playwright/test";
import { DEMO_ACCOUNTS, expectNoPageErrors, signIn, trackPageErrors } from "./helpers";

// Regression coverage for the two real bugs found by browser QA during frontend/backend
// integration (see docs/FRONTEND_INTEGRATION_CONFLICT_LEDGER.md and commits 3e38f57/d983b2a):
//
// 1. The decorative hero cover-photo box on both detail pages is `position: relative`, which per
//    CSS stacking rules paints above later non-positioned siblings regardless of DOM order — so
//    it silently intercepted every click meant for the Follow/Report buttons underneath it.
// 2. `_public.foundations.tsx` rendered list content directly with no <Outlet/>, so
//    `/foundations/$slug` never actually mounted its own component.
//
// These tests deliberately use normal (non-forced) clicks — a forced click would hide exactly the
// class of defect these tests exist to catch.
//
// The Follow button's own onClick branches on `isSignedIn` (from useAuth(), a React Query call)
// and its "Follow"/"Following" text depends on a separate followedQuery -- both start `undefined`
// on first render and only settle once their fetch resolves. `expect(followBtn).toBeVisible()`
// only proves the *element* exists, not that those two queries have settled -- a click landing in
// that window can take the wrong branch (falling through to "Sign in to follow kennels" instead
// of the real mutation) even though the button is fully visible and hit-testable. Root-caused by
// direct reproduction: a raw script with a 1.5s settle wait after navigation worked every time; the
// same click with no wait intermittently silently no-op'd. `networkidle` after navigating to the
// detail page is the general-purpose fix -- it waits for exactly the queries this page's own
// mount fires, without a magic-number sleep.
test.describe("follow/report controls @critical", () => {
  test("breeder detail: Follow button is hit-testable and toggles with a normal click", async ({
    page,
  }) => {
    const tracker = trackPageErrors(page);
    await signIn(page, DEMO_ACCOUNTS.buyer);

    await page.goto("/breeders");
    await page.locator('a[href^="/breeders/"]').first().click();
    await expect(page).toHaveURL(/\/breeders\/[^/]+$/);
    await page.waitForLoadState("networkidle");

    const followBtn = page.getByRole("button", { name: /Follow kennel|Following/ });
    await expect(followBtn).toBeVisible();
    const before = await followBtn.textContent();

    // A real, non-forced click — if the decorative hero overlay regresses to intercepting clicks
    // again, this will time out exactly like it did before the fix, rather than silently no-op.
    await followBtn.click();
    await expect(followBtn).not.toHaveText(before ?? "", { timeout: 5_000 });

    // restore original state so the suite is idempotent across runs
    await followBtn.click();
    await expect(followBtn).toHaveText(before ?? "", { timeout: 5_000 });

    expectNoPageErrors(tracker, "during breeder follow/unfollow");
  });

  test("breeder detail: Report button is hit-testable with a normal click", async ({ page }) => {
    await signIn(page, DEMO_ACCOUNTS.buyer);
    await page.goto("/breeders");
    await page.locator('a[href^="/breeders/"]').first().click();
    await expect(page).toHaveURL(/\/breeders\/[^/]+$/);
    await page.waitForLoadState("networkidle");

    const reportBtn = page.getByRole("button", { name: /report/i }).first();
    await expect(reportBtn).toBeVisible();
    await reportBtn.click();
    // Opening the report flow is enough to prove the click actually landed on the button and not
    // on the decorative overlay above it — the report dialog itself is covered separately.
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });
  });

  test("foundation detail: nested route renders its own page and Follow button is clickable", async ({
    page,
  }) => {
    const tracker = trackPageErrors(page);
    await signIn(page, DEMO_ACCOUNTS.buyer);

    await page.goto("/foundations");
    await page.locator('a[href^="/foundations/"]').first().click();
    await expect(page).toHaveURL(/\/foundations\/[^/]+$/);
    await page.waitForLoadState("networkidle");
    // Regression guard: the list page's own heading must not be present on the detail page.
    await expect(page.getByRole("heading", { name: "Foundations and rescues" })).toHaveCount(0);

    const followBtn = page.getByRole("button", { name: /Follow|Following/ }).first();
    await expect(followBtn).toBeVisible();
    const before = await followBtn.textContent();
    await followBtn.click();
    await expect(followBtn).not.toHaveText(before ?? "", { timeout: 5_000 });
    await followBtn.click();
    await expect(followBtn).toHaveText(before ?? "", { timeout: 5_000 });

    expectNoPageErrors(tracker, "during foundation follow/unfollow");
  });

  test("following a breeder is immediately reflected on the followed-profiles dashboard", async ({
    page,
  }, testInfo) => {
    // This test makes 4 sequential full navigations (list -> detail -> dashboard -> back to
    // detail), each with its own settle wait -- legitimately slower than the default per-test
    // timeout under Vite dev-mode's lazy per-route compilation, not a hang. Give it more headroom
    // rather than chase diminishing-returns micro-optimization on a test whose real assertions
    // (follow persists, dashboard reflects it) already pass well within their own waits.
    testInfo.setTimeout(45_000);
    await signIn(page, DEMO_ACCOUNTS.buyer);
    await page.goto("/breeders");
    await page.locator('a[href^="/breeders/"]').first().click();
    await expect(page).toHaveURL(/\/breeders\/[^/]+$/);
    await page.waitForLoadState("networkidle");

    const kennelName = await page.getByRole("heading", { level: 1 }).textContent();
    const breederUrl = page.url();
    const followBtn = page.getByRole("button", { name: /Follow kennel|Following/ });
    const wasFollowing = (await followBtn.textContent())?.includes("Following");
    if (!wasFollowing) {
      await followBtn.click();
      await expect(followBtn).toHaveText(/Following/, { timeout: 5_000 });
    }

    await page.goto("/dashboard/buyer/followed");
    if (kennelName) {
      await expect(page.getByText(kennelName.trim())).toBeVisible({ timeout: 5_000 });
    }

    // restore state — a fresh navigation back to the captured URL rather than page.goBack(),
    // which can restore stale SPA/query-cache state instead of a settled page. The real
    // assertions for this test already passed above; this is only cleanup, so check current text
    // defensively (same pattern as `wasFollowing` above) rather than assuming "Following" is what
    // renders, and don't fail the whole test over a cleanup step specifically.
    await page.goto(breederUrl);
    await page.waitForLoadState("networkidle");
    const restoreBtn = page.getByRole("button", { name: /Follow kennel|Following/ });
    await expect(restoreBtn).toBeVisible({ timeout: 10_000 });
    if ((await restoreBtn.textContent())?.includes("Following")) {
      await restoreBtn.click();
      await expect(restoreBtn).toHaveText(/Follow kennel/, { timeout: 5_000 });
    }
  });
});
