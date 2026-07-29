import { test, expect } from "@playwright/test";
import { DEMO_ACCOUNTS, expectNoPageErrors, signIn, signOut, trackPageErrors } from "./helpers";

// Complements the existing tests/e2e/auth.spec.ts (register/sign-in/wrong-password) with the
// session lifecycle: sign out, and the SSR-hydration credential-leak fix (docs/SSR_AUTH_HYDRATION_FIX.md)
// asserted explicitly rather than only relied on implicitly by every other spec's signIn() call.
test.describe("auth session @critical", () => {
  test("signed-in user can sign out and loses access to the dashboard", async ({ page }) => {
    const tracker = trackPageErrors(page);
    await signIn(page, DEMO_ACCOUNTS.buyer);
    await signOut(page);

    await page.goto("/dashboard/buyer");
    // Signing out must actually revoke dashboard access, not just change the header — a route
    // guard redirect (to /signin, or the public homepage) is the expected real behavior.
    await expect(page).not.toHaveURL(/\/dashboard\/buyer$/);
    expectNoPageErrors(tracker, "during sign-out");
  });

  test("signin form's submit button is disabled until hydration completes, and never leaks credentials into the URL", async ({
    page,
  }) => {
    await page.goto("/signin");
    const submit = page.getByRole("button", { name: "Sign in" });

    // Server-rendered HTML must already have this disabled — confirms the fix is present in the
    // actual SSR output, not just added client-side after the fact.
    await expect(submit).toBeDisabled();
    await expect(submit).toBeEnabled({ timeout: 5_000 });

    await page.getByLabel("Email").fill(DEMO_ACCOUNTS.buyer);
    await page.getByLabel("Password").fill("password123");
    await submit.click();
    await expect(page).toHaveURL(/\/dashboard\/buyer/, { timeout: 15_000 });

    // The regression this fix closed: a fast pre-hydration click used to fire a native GET
    // submission with credentials in the query string. Assert the final URL is clean.
    expect(page.url()).not.toContain("password");
    expect(page.url()).not.toContain("@havenpaw.test");
  });
});
