import type { ConsoleMessage, Page } from "@playwright/test";
import { expect } from "@playwright/test";

// Every account below is a committed local-only seed row (see docs/LOCAL_SETUP.md) — password is
// the same fake local-only value for all of them, never a real credential.
export const DEMO_PASSWORD = "password123";

export const DEMO_ACCOUNTS = {
  customer: "customer@anemalo.test",
  buyer: "buyer@anemalo.test",
  breeder: "breeder1@anemalo.test",
  breederSecondary: "breeder2@anemalo.test",
  breederPending: "breeder3-pending@anemalo.test",
  foundation: "foundation1@anemalo.test",
  foundationPending: "foundation2-pending@anemalo.test",
  ops: "ops@anemalo.test",
  driver: "driver@anemalo.test",
  admin: "admin@anemalo.test",
} as const;

// Many interactive controls in this app (Follow, Save, Sign out) branch their behavior or
// rendered state on a React Query result that starts undefined and only settles once its fetch
// resolves. `waitForLoadState("networkidle")` alone is necessary but not quite sufficient —
// confirmed by repeated real intermittent failures under this sandbox's variable load: network
// finishing isn't the same instant as React finishing its own re-render from that data. Centralized
// here (rather than a bare networkidle call duplicated at every call site) so the reasoning and the
// fix live in one place; every navigation followed by an interaction with a data-dependent control
// should call this instead of waitForLoadState("networkidle") directly.
export async function waitForDataSettled(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
}

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
// flow a user would actually have to follow (dashboard -> "Back to Anemalo" -> Sign out).
//
// The desktop Sign out button is `hidden lg:inline-flex` (site-chrome.tsx) -- on a real mobile
// viewport it's genuinely not in the DOM's visible set at all; sign-out there only exists behind
// the hamburger ("Open menu") panel. Confirmed via a real failed run on the mobile project before
// adding this branch, not assumed.
export async function signOut(page: Page) {
  await page.goto("/");
  // The header's own isSignedIn (useAuth(), a React Query call) has to settle before either the
  // desktop Sign out button or the mobile Sheet's signed-in branch renders -- same query-settle
  // race as elsewhere (see follow-report-controls.spec.ts). networkidle alone isn't quite enough
  // to rule this out (confirmed by a real failure: React hadn't finished its own re-render from
  // already-idle network data yet), so the desktop-vs-mobile branch below uses a genuinely
  // *retrying* wait (expect().toBeVisible(), not the instantaneous, non-retrying .isVisible())
  // before falling back to the mobile path -- otherwise a slow render reads as "not desktop" and
  // clicks a hamburger menu that was never actually needed (confirmed by a real failure on the
  // desktop chromium project specifically, its widest, least-ambiguous viewport).
  await page.waitForLoadState("networkidle");
  const desktopBtn = page.getByRole("button", { name: "Sign out" });
  let isDesktop = true;
  try {
    await expect(desktopBtn).toBeVisible({ timeout: 3_000 });
  } catch {
    isDesktop = false;
  }
  if (isDesktop) {
    await desktopBtn.click();
  } else {
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("button", { name: "Sign out" }).click();
  }
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
