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
test.describe("follow/report controls @critical", () => {
  test("breeder detail: Follow button is hit-testable and toggles with a normal click", async ({
    page,
  }) => {
    const tracker = trackPageErrors(page);
    await signIn(page, DEMO_ACCOUNTS.buyer);

    await page.goto("/breeders");
    await page.locator('a[href^="/breeders/"]').first().click();
    await expect(page).toHaveURL(/\/breeders\/[^/]+$/);

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
  }) => {
    await signIn(page, DEMO_ACCOUNTS.buyer);
    await page.goto("/breeders");
    await page.locator('a[href^="/breeders/"]').first().click();
    await expect(page).toHaveURL(/\/breeders\/[^/]+$/);

    const kennelName = await page.getByRole("heading", { level: 1 }).textContent();
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

    // restore state
    await page.goBack();
    await page.getByRole("button", { name: "Following" }).click();
  });
});
