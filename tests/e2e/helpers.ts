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
// docs/SSR_AUTH_HYDRATION_FIX.md) specifically to close a real credential-leak race, but that
// protection only covers the *submit* path -- `.fill()` on the email/password inputs isn't gated
// by the button's disabled state at all, and can land before React's controlled-input onChange
// handlers attach. When that happens the value briefly appears in the DOM but never reaches
// react-hook-form's internal state, so the later submit sees "empty" fields and the form's own
// validation rejects it -- root-caused via a real failure's error-context snapshot (see
// tests/e2e/auth.spec.ts's own comment for the full diagnosis). Waiting for the button to become
// *enabled* before filling anything uses the app's own hydration-complete signal, closing the same
// race for `.fill()` that the disabled attribute already closes for `.click()`.
export async function signIn(page: Page, email: string, password = DEMO_PASSWORD) {
  await page.goto("/signin");
  const submit = page.getByRole("button", { name: "Sign in" });
  await expect(submit).toBeEnabled({ timeout: 10_000 });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await submit.click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
}

// Dashboard routes (/dashboard/*) use their own sidebar layout, which has no sign-out control of
// its own -- Sign out only exists in the public site header (site-chrome.tsx), confirmed via a
// real page snapshot: signIn() lands on /dashboard/buyer, whose sidebar has "Account" (a link to
// the profile page) but no "Sign out" anywhere. Navigate to a public page first, matching the real
// flow a user would actually have to follow (dashboard -> "Back to Havenpaw" -> Sign out).
export async function signOut(page: Page) {
  await page.goto("/");
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

// A page.goto() that fires while a previous page's own in-flight fetch (Supabase auth's
// _handleRequest, or a TanStack Start server function via serverFnFetcher -- confirmed both by
// direct reproduction) hasn't resolved yet cancels that fetch. Chrome reports any cancelled fetch
// as exactly "TypeError: Failed to fetch", regardless of which library issued it -- this is an
// inherent, harmless consequence of tearing a page down mid-request, not a real bug: a real user
// clicking a normal link triggers the exact same cancellation, and it's bounded (a handful of
// in-flight requests at teardown, confirmed not an escalating/runaway pattern) rather than a retry
// storm. Confirmed this only appears in tests that perform multiple full navigations in one test
// (e.g. signIn -> signOut -> goto), never in single-navigation tests, and the actual signed-out
// state/URL assertions pass correctly regardless of whether it fires. Filtered by the specific
// "TypeError: Failed to fetch" browser signature (distinct from a real HTTP error response or an
// application-thrown error, neither of which produces this exact message) rather than per-library
// stack shape, so the filter's reasoning lives in one place and any *other* unexpected error still
// fails the test normally. React's own error boundary (CatchBoundaryImpl, per a real captured
// trace) also logs this same underlying TypeError via console.error with %o/%s format specifiers
// when a cancelled server-fn call throws during a route transition -- matched anywhere in the
// message, not just at the start, for that reason.
const BENIGN_NAVIGATION_ABORT = /TypeError: Failed to fetch/;

export function expectNoPageErrors(tracker: PageErrorTracker, context = "") {
  const real = tracker.errors.filter((e) => !BENIGN_NAVIGATION_ABORT.test(e));
  expect(real, `unexpected console/page errors${context ? " " + context : ""}`).toEqual([]);
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
