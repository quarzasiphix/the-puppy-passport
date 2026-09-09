import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

// The real production domain (see the "Production" section of CLAUDE.md) — hardcoded rather than
// derived from the incoming request's Host header, since a sitemap must always advertise the one
// canonical domain regardless of which host actually served the request (a staging/preview deploy
// must never emit a sitemap claiming to be the canonical production site).
export const SITE_ORIGIN = "https://anemalo.com";

type SitemapEntry = {
  path: string; // always starts with "/"
  changefreq: "daily" | "weekly" | "monthly";
  priority: number; // 0.0–1.0
  lastmod?: string; // ISO date, only when we actually know it (updated_at)
};

// Static, genuinely public/indexable marketing & discovery pages. Deliberately excludes: auth
// utility pages (signin/signup/forgot-password/reset-password — no SEO value, often carry query
// params), dashboard/admin/operations routes (behind auth, not indexable), invitations/moderation
// detail pages (private by nature), and /transport/request (a long form, not a landing page).
// /breeders/$slug is excluded on purpose — it's now a redirect to /@handle (see
// breeders.$slug.tsx), the canonical URL, so only the target is ever listed here.
const STATIC_ENTRIES: SitemapEntry[] = [
  { path: "/", changefreq: "daily", priority: 1.0 },
  { path: "/find-a-dog", changefreq: "daily", priority: 0.9 },
  { path: "/find-your-dog", changefreq: "weekly", priority: 0.6 },
  { path: "/breeders", changefreq: "daily", priority: 0.9 },
  { path: "/breeder-map", changefreq: "weekly", priority: 0.6 },
  { path: "/adoptions", changefreq: "daily", priority: 0.8 },
  { path: "/foundations", changefreq: "weekly", priority: 0.6 },
  { path: "/community", changefreq: "daily", priority: 0.5 },
  { path: "/community/groups", changefreq: "weekly", priority: 0.4 },
  { path: "/planned-litters", changefreq: "daily", priority: 0.7 },
  { path: "/planned-routes", changefreq: "weekly", priority: 0.5 },
  { path: "/how-it-works", changefreq: "monthly", priority: 0.5 },
  { path: "/estimate", changefreq: "monthly", priority: 0.4 },
  { path: "/create-breeder", changefreq: "monthly", priority: 0.5 },
  { path: "/rehome", changefreq: "monthly", priority: 0.4 },
  { path: "/transport", changefreq: "weekly", priority: 0.6 },
  { path: "/fundraising", changefreq: "weekly", priority: 0.4 },
  { path: "/terms", changefreq: "monthly", priority: 0.2 },
  { path: "/privacy", changefreq: "monthly", priority: 0.2 },
  { path: "/cookies", changefreq: "monthly", priority: 0.2 },
];

// A sitemap URL cap far below the protocol's real 50,000-URL limit — nowhere near reachable with
// today's dataset, just a sane guardrail so this never silently balloons unbounded.
const MAX_DYNAMIC_ENTRIES_PER_KIND = 5000;

async function dynamicEntries(): Promise<SitemapEntry[]> {
  const supabase = getSupabaseBrowserClient();

  const [breeders, puppies, adoptions] = await Promise.all([
    supabase
      .from("organisations")
      .select("slug, updated_at")
      .eq("org_type", "kennel")
      .eq("verification_status", "approved")
      .eq("is_public", true)
      .limit(MAX_DYNAMIC_ENTRIES_PER_KIND),
    supabase
      .from("animals")
      .select("id, updated_at")
      .eq("listing_category", "breeder_puppy")
      .eq("is_published", true)
      .limit(MAX_DYNAMIC_ENTRIES_PER_KIND),
    supabase
      .from("animals")
      .select("id, updated_at")
      .in("listing_category", ["adoption", "private_rehoming"])
      .eq("is_published", true)
      .limit(MAX_DYNAMIC_ENTRIES_PER_KIND),
  ]);

  const entries: SitemapEntry[] = [];
  for (const b of breeders.data ?? []) {
    entries.push({ path: `/@${b.slug}`, changefreq: "weekly", priority: 0.7, lastmod: b.updated_at });
  }
  for (const p of puppies.data ?? []) {
    entries.push({
      path: `/puppies/${p.id}`,
      changefreq: "weekly",
      priority: 0.6,
      lastmod: p.updated_at,
    });
  }
  for (const a of adoptions.data ?? []) {
    entries.push({
      path: `/adoptions/${a.id}`,
      changefreq: "weekly",
      priority: 0.6,
      lastmod: a.updated_at,
    });
  }
  return entries;
}

function toUrlTag(entry: SitemapEntry): string {
  const loc = `${SITE_ORIGIN}${entry.path}`;
  const lastmodTag = entry.lastmod ? `<lastmod>${entry.lastmod.slice(0, 10)}</lastmod>` : "";
  return `<url><loc>${loc}</loc>${lastmodTag}<changefreq>${entry.changefreq}</changefreq><priority>${entry.priority.toFixed(1)}</priority></url>`;
}

// Best-effort: if the dynamic query fails (DB hiccup), still emit the static entries rather than a
// 500 — a sitemap missing today's newest listings is a far smaller problem than search engines
// getting an error on every crawl attempt and eventually deprioritizing the whole site.
export async function generateSitemapXml(): Promise<string> {
  let dynamic: SitemapEntry[] = [];
  try {
    dynamic = await dynamicEntries();
  } catch (error) {
    console.error("sitemap: dynamic entries failed, emitting static entries only", error);
  }

  const urls = [...STATIC_ENTRIES, ...dynamic].map(toUrlTag).join("");
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`
  );
}

export function generateRobotsTxt(): string {
  // Disallow the same surfaces excluded from the sitemap above, plus auth/dashboard/admin — a
  // search engine finding its way to e.g. /dashboard/buyer via some other link should still be
  // told not to index it, not just "not listed."
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /dashboard/",
    "Disallow: /auth/",
    "Disallow: /signin",
    "Disallow: /signup",
    "Disallow: /forgot-password",
    "Disallow: /reset-password",
    "Disallow: /invitations/",
    "Disallow: /moderation/",
    "",
    `Sitemap: ${SITE_ORIGIN}/sitemap.xml`,
    "",
  ].join("\n");
}
