import { test, expect } from "@playwright/test";

// Real registration + login against the local Supabase stack. Each run creates a genuinely new
// account (unique email per run) rather than reusing seed data, so this also exercises the real
// signUp code path end to end, not just signIn against a pre-seeded account.
test("a new visitor can register with a password and is signed in immediately", async ({
  page,
}) => {
  const email = `e2e-${Date.now()}@anemalo.test`;

  await page.goto("/signup");
  await page.getByText("Request animal transport", { exact: false }).click();
  await page.getByLabel("First name").fill("E2E");
  await page.getByLabel("Last name").fill("Tester");
  await page.getByLabel("Email").fill(email);
  // Passwordless is the default now — opt into the password path.
  await page.getByRole("button", { name: "Use a password instead" }).click();
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 2 is now entirely optional details — go straight to submit.
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/dashboard\/buyer/, { timeout: 15_000 });
});

test("the magic-link option shows a 'check your email' confirmation", async ({ page }) => {
  await page.goto("/signin");
  await page.getByLabel("Email").fill(`e2e-magic-${Date.now()}@anemalo.test`);
  await page.getByRole("button", { name: /email me a sign-in link/i }).click();

  await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: /resend link/i })).toBeVisible();
});

test("an existing demo account can sign in with a password and see its own dashboard", async ({
  page,
}) => {
  await page.goto("/signin");
  await page.getByLabel("Email").fill("buyer@anemalo.test");
  await page.getByRole("button", { name: "Use a password instead" }).click();
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/dashboard\/buyer/, { timeout: 15_000 });
  // A real signed-in dashboard, not a generic shell — assert something specific to being logged
  // in rather than just "the URL changed".
  await expect(page.getByRole("link", { name: /sign in/i })).toHaveCount(0);
});

test("wrong password is rejected with a real error, not a silent redirect", async ({ page }) => {
  await page.goto("/signin");
  await page.getByLabel("Email").fill("buyer@anemalo.test");
  await page.getByRole("button", { name: "Use a password instead" }).click();
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByText(/invalid|incorrect|credentials/i)).toBeVisible({ timeout: 10_000 });
  await expect(page).toHaveURL(/\/signin/);
});
