import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

// Used for all data queries — TanStack Router loaders (which run isomorphically) and client
// components/hooks alike. RLS enforces access either way; this client never needs elevated
// privileges.
//
// The missing-config guard lives INSIDE this function on purpose: throwing at module scope
// takes down worker initialisation before src/server.ts can catch it, so Cloudflare returns an
// opaque unhandled 500 instead of the app's own error page. Failing here instead keeps the
// failure recoverable and legible.
export function getSupabaseBrowserClient() {
  if (!url || !anonKey) {
    throw new Error(
      "Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. These are inlined at build time — set " +
        "them in .env (local) or .env.production (committed, deployed builds). See LOCAL_SETUP.md.",
    );
  }
  if (!client) {
    client = createBrowserClient<Database>(url, anonKey);
  }
  return client;
}
