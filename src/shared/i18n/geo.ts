import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import type { Locale } from "./index";

// Geo/language *suggestion* only — never a forced redirect. Google explicitly advises against
// automatic IP-based redirects (breaks crawling of the non-redirected version, annoys VPN/expat
// visitors); the product decision here (2026-09) is a small dismissible banner offering to switch,
// which LocaleSuggestionBanner renders. This must run server-side: `cf-ipcountry` (set
// automatically by Cloudflare on every request reaching the Worker — see
// docs/DEPLOYMENT_CHECKLIST.md) and a first-request `Accept-Language` are both request headers, not
// something the browser JS can read directly. Called from the client via useQuery (see
// locale-suggestion-banner.tsx) rather than wired through the root route's beforeLoad/context, so
// it stays a self-contained, independently cacheable addition — not a change to root routing.
export const getSuggestedLocale = createServerFn({ method: "GET" }).handler(
  async (): Promise<Locale | null> => {
    // Cloudflare-specific header, present only when this Worker actually receives the request
    // through Cloudflare's edge (i.e. production) — absent in local dev, which is fine, the
    // Accept-Language fallback below still works locally.
    const country = getRequestHeader("cf-ipcountry")?.toUpperCase();
    if (country === "PL") return "pl";

    const acceptLanguage = getRequestHeader("accept-language") ?? "";
    // A real Accept-Language header is a comma-separated, q-weighted list (e.g.
    // "pl-PL,pl;q=0.9,en;q=0.8") — checking the first tag's primary subtag is enough here; this
    // only ever produces a soft suggestion, never a decision anything depends on being exact.
    const primaryTag = acceptLanguage.split(",")[0]?.trim().toLowerCase();
    if (primaryTag?.startsWith("pl")) return "pl";

    return null;
  },
);
