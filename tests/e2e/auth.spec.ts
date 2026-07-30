import { test, expect, type Page, type Locator } from "@playwright/test";

// Every auth form disables its submit button until client hydration completes (see
// docs/SSR_AUTH_HYDRATION_FIX.md), specifically to close a credential-leak race on the *submit*
// path. That protection doesn't cover `.fill()` on the email/password inputs themselves, though:
// `.fill()` sets a value at the DOM/CDP level and can race ahead of hydration, landing before
// React's controlled-input onChange handlers attach — the value briefly appears in the DOM but
// never reaches react-hook-form's internal state, so the later submit sees "empty" fields and the
// form's own client-side validation correctly (if confusingly, from the test's point of view)
// rejects it with "Enter a valid email" / "Required". Root-caused via a real failure's
// error-context snapshot showing exactly those validation messages after a `.fill()` + click that
// looked like it should have worked. The fix: wait for the disabled-until-hydrated button to
// become enabled — the same signal the app itself uses — before filling anything, rather than
// switching to slower key-by-key typing everywhere.
async function fillAfterHydration(page: Page, submitButton: Locator, fields: [string, string][]) {
  await expect(submitButton).toBeEnabled({ timeout: 10_000 });
  for (const [label, value] of fields) {
    await page.getByLabel(label).fill(value);
  }
}

// Real registration + login against the local Supabase stack. Each run creates a genuinely new
// account (unique email per run) rather than reusing seed data, so this also exercises the real
// signUp code path end to end, not just signIn against a pre-seeded account.
test("a new visitor can register and is signed in immediately", async ({ page }) => {
  const email = `e2e-${Date.now()}@havenpaw.test`;

  await page.goto("/signup");
  await page.getByText("Request animal transport", { exact: false }).click();
  const continueBtn = page.getByRole("button", { name: "Continue" });
  await fillAfterHydration(page, continueBtn, [
    ["Email", email],
    ["Password", "password123"],
  ]);
  await continueBtn.click();

  const createBtn = page.getByRole("button", { name: "Create account" });
  await fillAfterHydration(page, createBtn, [
    ["First name", "E2E"],
    ["Last name", "Tester"],
  ]);
  await createBtn.click();

  await expect(page).toHaveURL(/\/dashboard\/buyer/, { timeout: 15_000 });
});

test("an existing demo account can sign in and see its own dashboard", async ({ page }) => {
  await page.goto("/signin");
  const signInBtn = page.getByRole("button", { name: "Sign in" });
  await fillAfterHydration(page, signInBtn, [
    ["Email", "buyer@havenpaw.test"],
    ["Password", "password123"],
  ]);
  await signInBtn.click();

  await expect(page).toHaveURL(/\/dashboard\/buyer/, { timeout: 15_000 });
  // A real signed-in dashboard, not a generic shell — assert something specific to being logged
  // in rather than just "the URL changed".
  await expect(page.getByRole("link", { name: /sign in/i })).toHaveCount(0);
});

test("wrong password is rejected with a real error, not a silent redirect", async ({ page }) => {
  await page.goto("/signin");
  const signInBtn = page.getByRole("button", { name: "Sign in" });
  await fillAfterHydration(page, signInBtn, [
    ["Email", "buyer@havenpaw.test"],
    ["Password", "wrong-password"],
  ]);
  await signInBtn.click();

  await expect(page.getByText(/invalid|incorrect|credentials/i)).toBeVisible({ timeout: 10_000 });
  await expect(page).toHaveURL(/\/signin/);
});
