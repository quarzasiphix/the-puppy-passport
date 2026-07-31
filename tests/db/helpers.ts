// Shared fixtures for the database/API regression suite. Node-based, no browser: every test in
// tests/db/ signs in as a real seeded demo account (see docs/LOCAL_SETUP.md) against a running
// local Supabase stack and makes real PostgREST/GoTrue/RPC calls through @supabase/supabase-js —
// the same client library the app itself uses, just from Node instead of a browser.
//
// These tests assume `npm run db:start` has already loaded supabase/seed.sql and do not reset the
// database themselves (same rule as tests/e2e — resetting would wipe demo data other tests and
// developers rely on). See docs/DATABASE_TESTING.md.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Derived from this worktree's own supabase/config.toml (falls back to the documented default
// port if that can't be read) rather than a bare hardcoded 54321 -- confirmed the hard way that a
// hardcoded default silently sends every test:db run at whichever worktree happens to be using the
// real default port, even from a worktree deliberately configured with different ports for
// isolation (see docs/HARDENING_ISOLATED_DB_VERIFICATION.md for the full incident). SUPABASE_URL
// env var still wins if explicitly set, same as before.
function defaultSupabaseUrl(): string {
  try {
    const configPath = join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "supabase",
      "config.toml",
    );
    const config = readFileSync(configPath, "utf8");
    const apiSection = config.slice(config.indexOf("[api]"));
    const port = apiSection.match(/^port\s*=\s*(\d+)/m)?.[1];
    if (port) return `http://127.0.0.1:${port}`;
  } catch {
    // fall through to the documented default below
  }
  return "http://127.0.0.1:54321";
}

const SUPABASE_URL = process.env.SUPABASE_URL ?? defaultSupabaseUrl();
// Well-known local-only demo keys printed by `supabase status` — not secrets, never valid against
// a real project. Overridable via env in case a future session changes supabase/config.toml.
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

export const PASSWORD = "password123";

// Profile ids from supabase/seed.sql — stable across `db:reset` since the seed hard-codes them.
export const ids = {
  customer: "10000000-0000-0000-0000-000000000001",
  buyer: "10000000-0000-0000-0000-000000000002",
  breeder1: "10000000-0000-0000-0000-000000000003",
  breeder2: "10000000-0000-0000-0000-000000000004",
  breederPending: "10000000-0000-0000-0000-000000000005",
  foundation1: "10000000-0000-0000-0000-000000000006",
  foundationPending: "10000000-0000-0000-0000-000000000007",
  ops: "10000000-0000-0000-0000-000000000008",
  driver: "10000000-0000-0000-0000-000000000009",
  admin: "10000000-0000-0000-0000-000000000010",

  orgCichyLas: "20000000-0000-0000-0000-000000000001",
  orgWolnaDolina: "20000000-0000-0000-0000-000000000002",
  orgFundacja: "20000000-0000-0000-0000-000000000003",

  animalMaja: "60000000-0000-0000-0000-000000000001", // Cichy Las, available, published
  animalNero: "60000000-0000-0000-0000-000000000004", // Cichy Las, draft, NOT published
  animalFabian: "60000000-0000-0000-0000-000000000003", // Cichy Las, buyer's approved application
  animalRico: "60000000-0000-0000-0000-000000000005", // Wolna Dolina
  animalReksio: "60000000-0000-0000-0000-000000000011", // Fundacja adoption listing

  applicationFabian: "70000000-0000-0000-0000-000000000001", // buyer -> Cichy Las, approved

  driverRecord: "90000000-0000-0000-0000-000000000001",
  vehicle: "80000000-0000-0000-0000-000000000001",

  transportWarsawAmsterdam: "a0000000-0000-0000-0000-000000000001", // customer, driver-assigned
  transportKrakow: "a0000000-0000-0000-0000-000000000002", // buyer's own
  transportBerlin: "a0000000-0000-0000-0000-000000000003", // customer's own, no driver assigned
  transportReksio: "a0000000-0000-0000-0000-000000000005", // foundation1, Reksio's rescue transport

  routeWarsawAmsterdam: "b0000000-0000-0000-0000-000000000001", // driver's assigned route
} as const;

export const personas = {
  customer: "customer@havenpaw.test",
  buyer: "buyer@havenpaw.test",
  breeder1: "breeder1@havenpaw.test",
  breeder2: "breeder2@havenpaw.test",
  breederPending: "breeder3-pending@havenpaw.test",
  foundation1: "foundation1@havenpaw.test",
  foundationPending: "foundation2-pending@havenpaw.test",
  ops: "ops@havenpaw.test",
  driver: "driver@havenpaw.test",
  admin: "admin@havenpaw.test",
} as const;

export type Persona = keyof typeof personas;

const clientCache = new Map<Persona, Promise<SupabaseClient>>();
let anonClient: SupabaseClient | undefined;

/**
 * A brand-new, uncached anonymous client against the correctly-resolved local instance (see
 * defaultSupabaseUrl() above). Exported specifically for test files that need their own disposable
 * signed-up-throwaway-user client (account deletion, legal holds, risk signals, verification
 * approval, consent versioning, etc.) rather than the shared cached `anon()`/`as()` clients --
 * those files used to each duplicate their own local `SUPABASE_URL`/`ANON_KEY` constants with the
 * bare hardcoded 54321 default, silently pointing every disposable-signup test at the shared
 * instance even when the rest of the same file correctly used the isolated one via `as()`. That
 * cross-database mismatch (a verification/case/request created via a disposable client on one
 * database, then operated on via `as("admin")` on a *different* one) is what actually produced the
 * "invalid input syntax for type uuid: 'undefined'" and "not found" failures traced back here --
 * not environmental flakiness. See docs/HARDENING_ISOLATED_DB_VERIFICATION.md.
 */
export function freshClient(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** An unauthenticated client, exactly what an anonymous site visitor's browser would send. */
export function anon(): SupabaseClient {
  if (!anonClient) anonClient = freshClient();
  return anonClient;
}

/**
 * A signed-in client for one of the ten seeded demo accounts (see docs/LOCAL_SETUP.md). Cached
 * per persona for the whole test run — real sign-in round-trips are slow and every test in this
 * suite reuses the same ten accounts, never creating throwaway auth users.
 */
export async function as(persona: Persona): Promise<SupabaseClient> {
  const cached = clientCache.get(persona);
  if (cached) return cached;

  const promise = (async () => {
    const client = freshClient();
    const { error } = await client.auth.signInWithPassword({
      email: personas[persona],
      password: PASSWORD,
    });
    if (error) {
      throw new Error(`Could not sign in as ${persona} (${personas[persona]}): ${error.message}`);
    }
    return client;
  })();

  clientCache.set(persona, promise);
  return promise;
}

/** True for an empty result set — the normal, silent shape of "RLS filtered this row out". */
export function isEmpty(data: unknown): boolean {
  return Array.isArray(data) && data.length === 0;
}

/** True for a PostgREST/Postgres permission-denied response (RLS or missing GRANT). */
export function isForbidden(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42501" ||
    error.code === "PGRST301" ||
    /permission denied/i.test(error.message ?? "") ||
    /JWT/i.test(error.message ?? "")
  );
}

/**
 * A request is "blocked" from this client's point of view if it's either rejected outright
 * (permission error) or silently filtered to nothing by RLS (empty result, no error) — both are
 * correct, expected shapes for "you may not see/affect this row" and callers of this helper don't
 * care which one a given policy happens to produce, only that data did NOT leak through.
 */
export function isBlocked(
  data: unknown,
  error: { code?: string; message?: string } | null,
): boolean {
  return isForbidden(error) || isEmpty(data);
}

/**
 * Stage AM: test factories/deterministic fixtures. Five different test files had converged on
 * the same ~10-line "insert a fresh transport_requests row with standard Poland->Germany fields"
 * block, each with its own slightly different request_number scheme. Centralising it here means
 * new tests get a deterministic, collision-free request_number for free (a random suffix, not
 * just Date.now(), so two calls in the same millisecond from a fast test run never collide) and a
 * single place to update if the required-columns shape ever changes. Throws on failure (a setup
 * helper failing should fail the test loudly, not be silently swallowed) rather than returning a
 * {data, error} tuple like the raw client does — callers that need to assert the insert error
 * itself (as opposed to just needing a valid fixture row to exist) should keep using a raw
 * `.insert()` call instead of this helper.
 */
export async function createTestTransportRequest(
  client: SupabaseClient,
  input: {
    requesterProfileId: string;
    tag?: string;
    status?: string;
    [column: string]: unknown;
  },
): Promise<string> {
  const { requesterProfileId, tag = "TEST", ...overrides } = input;
  const requestNumber = `TR-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const { data, error } = await client
    .from("transport_requests")
    .insert({
      requester_profile_id: requesterProfileId,
      request_number: requestNumber,
      request_purpose: "own_dog",
      animal_name: "Test Dog",
      pickup_country: "Poland",
      pickup_city: "Warsaw",
      destination_country: "Germany",
      destination_city: "Berlin",
      status: "draft",
      ...overrides,
    })
    .select("id")
    .single();
  if (error) throw new Error(`createTestTransportRequest failed: ${error.message}`);
  return data!.id as string;
}

/**
 * Stage XR-19: fixture determinism audit. Several test files independently generate a disposable
 * `auth.signUp()` email as `` `prefix-test-${Date.now()}@havenpaw.test` `` with no random
 * component — the exact "theoretically collision-prone in a fast run" shape Stage AM's own
 * `createTestTransportRequest()` comment already named and fixed for request numbers, just never
 * re-applied here. A collision here is more severe than most: `auth.signUp()` fails outright with
 * "email already registered" (an infrastructure-level setup failure, not a clean assertion
 * failure), and two Date.now() calls landing in the same millisecond, while empirically never
 * observed across this whole session's many consecutive `test:db` runs, is not actually
 * impossible — Node's clock resolution is coarser than the wall-clock time a fast synchronous
 * `Date.now()` call can complete in. Centralised here, matching the transport-request factory's
 * own precedent, rather than fixing each call site's ad hoc template string individually.
 */
export function uniqueTestEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@havenpaw.test`;
}
