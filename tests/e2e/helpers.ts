import type { ConsoleMessage, Page } from "@playwright/test";
import { expect } from "@playwright/test";

// Every account below is a committed local-only seed row (see docs/LOCAL_SETUP.md) — password is
// the same fake local-only value for all of them, never a real credential.
export const DEMO_PASSWORD = "password123";

export const DEMO_ACCOUNTS = {
  customer: "customer@havenpaw.test",
  buyer: "buyer@havenpaw.test",
  breeder: "breeder1@havenpaw.test",
  breederSecondary: "breeder2@havenpaw.test",
  breederPending: "breeder3-pending@havenpaw.test",
  foundation: "foundation1@havenpaw.test",
  foundationPending: "foundation2-pending@havenpaw.test",
  ops: "ops@havenpaw.test",
  driver: "driver@havenpaw.test",
  admin: "admin@havenpaw.test",
} as const;

export type DemoAccountKey = keyof typeof DEMO_ACCOUNTS;

// Every auth form on this app disables its submit button until client hydration completes (see
// docs/SSR_AUTH_HYDRATION_FIX.md) specifically to close a real credential-leak race. Playwright's
// own actionability check already waits for a locator to become enabled before `.click()`
// resolves, so this needs no manual sleep — asserting that behavior here (rather than just relying
// on it implicitly) documents *why* callers never need one and gives an explicit regression check
// if that protection is ever accidentally removed from a form.
export async function signIn(page: Page, email: string, password = DEMO_PASSWORD) {
  await page.goto("/signin");
  const submit = page.getByRole("button", { name: "Sign in" });
  await expect(submit).toBeDisabled();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await submit.click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
}

export async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("link", { name: /sign in/i })).toBeVisible({ timeout: 10_000 });
}

export type PageErrorTracker = {
  errors: string[];
};

// Installs console/page-error listeners before any navigation happens, so nothing that fires
// during the very first goto is missed. Call this once per test right after `page` is available,
// before the first `page.goto`.
export function trackPageErrors(page: Page): PageErrorTracker {
  const tracker: PageErrorTracker = { errors: [] };
  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() === "error") tracker.errors.push(msg.text());
  });
  page.on("pageerror", (err) => tracker.errors.push(String(err)));
  return tracker;
}

export function expectNoPageErrors(tracker: PageErrorTracker, context = "") {
  expect(tracker.errors, `unexpected console/page errors${context ? " " + context : ""}`).toEqual(
    [],
  );
}

// A handful of routes intentionally render a raw internal enum/status while a translation map is
// only wired for some values (customer-facing translation is a per-page CLAUDE.md requirement, not
// a framework guarantee) — this only checks for the specific known-bad raw values found during
// integration (see docs/FRONTEND_INTEGRATION_CONFLICT_LEDGER.md entries 4-6), not a general claim
// that no page ever renders any lowercase word.
const KNOWN_RAW_ENUM_LEAKS = [
  /\bsent\b/i,
  /\bviewed\b/i,
  /\breplaced\b/i,
  /\bplanning\b/i,
] as const;

export async function expectNoRawEnumLeak(page: Page, translatedMarkers: RegExp[]) {
  const body = await page.locator("body").innerText();
  const hasTranslation = translatedMarkers.some((re) => re.test(body));
  if (hasTranslation) return; // translated label present — the page has real data, and it's translated
  for (const re of KNOWN_RAW_ENUM_LEAKS) {
    expect(body, `possible raw enum leak matching ${re}`).not.toMatch(re);
  }
}
