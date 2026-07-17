import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in " +
      "the values from `supabase start` (see LOCAL_SETUP.md).",
  );
}

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

// Used for all data queries — TanStack Router loaders (which run isomorphically) and client
// components/hooks alike. RLS enforces access either way; this client never needs elevated
// privileges.
export function getSupabaseBrowserClient() {
  if (!client) {
    client = createBrowserClient<Database>(url, anonKey);
  }
  return client;
}
