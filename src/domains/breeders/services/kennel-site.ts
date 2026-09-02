import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { defaultKennelSiteConfiguration } from "../types";
import type { KennelSection, KennelSiteConfiguration } from "../types";

type SiteConfigRow = {
  organisation_id: string;
  theme: KennelSiteConfiguration["theme"];
  primary_color: string | null;
  logo_asset_id: string | null;
  cover_asset_id: string | null;
  visible_sections: KennelSection[];
  section_order: KennelSection[];
  default_language: string;
  supported_languages: string[];
  contact_mode: KennelSiteConfiguration["contactMode"];
  show_anemalo_branding: boolean;
};

function mapConfig(r: SiteConfigRow): KennelSiteConfiguration {
  return {
    kennelId: r.organisation_id,
    theme: r.theme,
    primaryColor: r.primary_color,
    logoAssetId: r.logo_asset_id,
    coverAssetId: r.cover_asset_id,
    visibleSections: r.visible_sections,
    sectionOrder: r.section_order,
    defaultLanguage: r.default_language,
    supportedLanguages: r.supported_languages,
    contactMode: r.contact_mode,
    showAnemaloBranding: r.show_anemalo_branding,
  };
}

export async function getKennelSiteConfiguration(
  kennelId: string,
): Promise<KennelSiteConfiguration> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("organisation_site_configurations")
    .select(
      "organisation_id, theme, primary_color, logo_asset_id, cover_asset_id, visible_sections, section_order, default_language, supported_languages, contact_mode, show_anemalo_branding",
    )
    .eq("organisation_id", kennelId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapConfig(data as SiteConfigRow) : defaultKennelSiteConfiguration(kennelId);
}

export async function updateKennelSiteConfiguration(
  kennelId: string,
  patch: Partial<
    Pick<
      KennelSiteConfiguration,
      | "theme"
      | "primaryColor"
      | "visibleSections"
      | "sectionOrder"
      | "defaultLanguage"
      | "supportedLanguages"
      | "contactMode"
      | "showAnemaloBranding"
    >
  >,
): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  // Merge onto the current (or default) configuration and upsert the full, explicitly-typed row
  // — a dynamically-assembled partial object doesn't satisfy supabase-js's generated Insert type,
  // and reading-then-merging is also simply more correct for a config row that may not exist yet.
  const current = await getKennelSiteConfiguration(kennelId);
  const merged: KennelSiteConfiguration = { ...current, ...patch, kennelId };

  const { error } = await supabase.from("organisation_site_configurations").upsert(
    {
      organisation_id: merged.kennelId,
      theme: merged.theme,
      primary_color: merged.primaryColor,
      visible_sections: merged.visibleSections,
      section_order: merged.sectionOrder,
      default_language: merged.defaultLanguage,
      supported_languages: merged.supportedLanguages,
      contact_mode: merged.contactMode,
      show_anemalo_branding: merged.showAnemaloBranding,
    },
    { onConflict: "organisation_id" },
  );
  if (error) throw error;
}
