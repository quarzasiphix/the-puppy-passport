import type { Database } from "@/lib/supabase/types";

// Kennel portal types. A kennel IS the existing public.organisations row (org_type = 'kennel' /
// 'foundation' / 'shelter') — this domain does not introduce a parallel entity. See
// docs/SOCIAL_DOMAIN.md "Core entity distinctions."

export type KennelTheme = Database["public"]["Enums"]["kennel_theme"];
export type KennelContactMode = Database["public"]["Enums"]["kennel_contact_mode"];
export type KennelSection = Database["public"]["Enums"]["kennel_section"];

export const KENNEL_SECTIONS: readonly KennelSection[] = [
  "about",
  "gallery",
  "posts",
  "dogs",
  "litters",
  "planned_litters",
  "listings",
  "pedigrees",
  "health",
  "achievements",
  "reviews",
  "transport",
  "contact",
];

export const KENNEL_SECTION_LABELS: Record<KennelSection, string> = {
  about: "About",
  gallery: "Gallery",
  posts: "Posts",
  dogs: "Dogs",
  litters: "Litters",
  planned_litters: "Planned litters",
  listings: "Listings",
  pedigrees: "Pedigrees",
  health: "Health & living",
  achievements: "Achievements",
  reviews: "Reviews",
  transport: "Transport",
  contact: "Contact",
};

/** Matches supabase/migrations/20260903000400_kennel_site_configuration.sql exactly. A controlled
 * configuration model, not a free-form website builder — see docs/SOCIAL_DOMAIN.md. */
export type KennelSiteConfiguration = {
  kennelId: string;
  theme: KennelTheme;
  primaryColor: string | null;
  logoAssetId: string | null;
  coverAssetId: string | null;
  visibleSections: KennelSection[];
  sectionOrder: KennelSection[];
  defaultLanguage: string;
  supportedLanguages: string[];
  contactMode: KennelContactMode;
  showAnemaloBranding: boolean;
};

const DEFAULT_KENNEL_SECTIONS: KennelSection[] = [
  "about",
  "gallery",
  "posts",
  "dogs",
  "litters",
  "planned_litters",
  "achievements",
  "contact",
];

/**
 * A kennel with no configuration row yet renders with these defaults — never an error, never a
 * blank page. Matches every row's own DB defaults
 * (supabase/migrations/20260903000400_kennel_site_configuration.sql). Pure — no Supabase import,
 * deliberately, so it stays unit-testable under the plain Node test runner (see
 * tests/unit/social-domain.test.ts and domains/reservations/status.ts for the same pattern).
 */
export function defaultKennelSiteConfiguration(kennelId: string): KennelSiteConfiguration {
  return {
    kennelId,
    theme: "classic",
    primaryColor: null,
    logoAssetId: null,
    coverAssetId: null,
    visibleSections: DEFAULT_KENNEL_SECTIONS,
    sectionOrder: DEFAULT_KENNEL_SECTIONS,
    defaultLanguage: "en",
    supportedLanguages: ["en"],
    contactMode: "anemalo",
    showAnemaloBranding: true,
  };
}

/**
 * Tenant/domain mapping — schema exists (organisation_domains), no DNS/routing infrastructure
 * exists yet. See docs/SOCIAL_DOMAIN.md "Future subdomains and custom domains" and
 * docs/DEFERRED_BACKEND.md.
 */
export type KennelDomain = {
  id: string;
  kennelId: string;
  hostname: string;
  type: Database["public"]["Enums"]["organisation_domain_type"];
  status: Database["public"]["Enums"]["organisation_domain_status"];
  verificationToken: string | null;
  isPrimary: boolean;
};

/**
 * Centralised capability model (Monetization foundation). Never scatter `plan === "pro"` checks
 * through the UI — read capabilities from here. `organisations.plan` is a real column (default
 * 'free' for every existing kennel); nothing here is enforced by billing, because no payment
 * provider exists yet (docs/DEFERRED_BACKEND.md) — these are honest boundaries a future billing
 * integration will gate, not a fake paywall.
 */
export type KennelPlan = "free" | "pro" | "website";

export type KennelCapabilities = {
  canUseSubdomain: boolean;
  canUseCustomDomain: boolean;
  canCustomizeTheme: boolean;
  canRemoveAnemaloBranding: boolean;
  canViewAdvancedAnalytics: boolean;
  canAddTeamMembers: boolean;
  mediaStorageLimitMb: number;
  monthlyPedigreeImportLimit: number;
  supportedLanguageLimit: number;
};

export function getKennelCapabilities(plan: KennelPlan): KennelCapabilities {
  switch (plan) {
    case "website":
      return {
        canUseSubdomain: true,
        canUseCustomDomain: true,
        canCustomizeTheme: true,
        canRemoveAnemaloBranding: true,
        canViewAdvancedAnalytics: true,
        canAddTeamMembers: true,
        mediaStorageLimitMb: 20000,
        monthlyPedigreeImportLimit: 200,
        supportedLanguageLimit: 10,
      };
    case "pro":
      return {
        canUseSubdomain: true,
        canUseCustomDomain: false,
        canCustomizeTheme: true,
        canRemoveAnemaloBranding: false,
        canViewAdvancedAnalytics: true,
        canAddTeamMembers: true,
        mediaStorageLimitMb: 5000,
        monthlyPedigreeImportLimit: 25,
        supportedLanguageLimit: 3,
      };
    case "free":
    default:
      return {
        canUseSubdomain: false,
        canUseCustomDomain: false,
        canCustomizeTheme: false,
        canRemoveAnemaloBranding: false,
        canViewAdvancedAnalytics: false,
        canAddTeamMembers: false,
        mediaStorageLimitMb: 500,
        monthlyPedigreeImportLimit: 3,
        supportedLanguageLimit: 1,
      };
  }
}
