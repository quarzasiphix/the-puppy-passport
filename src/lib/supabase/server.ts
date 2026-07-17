import { createServerClient } from "@supabase/ssr";
import { deleteCookie, getCookies, setCookie } from "@tanstack/react-start/server";
import type { Database } from "./types";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Cookie-aware client for use ONLY inside createServerFn handlers: SSR session lookup for route
// guards, and sign-in/sign-up/sign-out actions (so Set-Cookie lands on the actual response).
// Everything else (data queries) should use the browser client — see browser.ts.
export function getSupabaseServerClient() {
  if (!url || !anonKey) {
    throw new Error(
      "Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in " +
        "the values from `supabase start` (see LOCAL_SETUP.md).",
    );
  }

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        const cookies = getCookies();
        return Object.entries(cookies).map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          if (value === "") {
            deleteCookie(name, options as Parameters<typeof deleteCookie>[1]);
          } else {
            setCookie(name, value, options as Parameters<typeof setCookie>[2]);
          }
        }
      },
    },
  });
}
