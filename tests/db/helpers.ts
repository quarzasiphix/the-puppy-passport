// Shared fixtures for the database/API regression suite. Node-based, no browser: every test in
// tests/db/ signs in as a real seeded demo account (see docs/LOCAL_SETUP.md) against a running
// local Supabase stack and makes real PostgREST/GoTrue/RPC calls through @supabase/supabase-js —
// the same client library the app itself uses, just from Node instead of a browser.
//
// These tests assume `npm run db:start` has already loaded supabase/seed.sql and do not reset the
// database themselves (same rule as tests/e2e — resetting would wipe demo data other tests and
// developers rely on). See docs/DATABASE_TESTING.md.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
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

function freshClient(): SupabaseClient {
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
