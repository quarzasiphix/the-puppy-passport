import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Database } from "@/lib/supabase/types";

// Stage I: admin organisation management. "admins manage all organisations" RLS already existed
// (20260101000500_organizations.sql) — only the UI was ever missing (dashboard.admin.organisations.tsx
// was an honest NotImplemented placeholder).

export type OrganisationRow = Database["public"]["Tables"]["organisations"]["Row"];

export async function listAllOrganisationsForAdmin() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("organisations")
    .select(
      "id, name, org_type, country, city, verification_status, is_public, is_featured, transport_available, created_at",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Pick<
    OrganisationRow,
    | "id"
    | "name"
    | "org_type"
    | "country"
    | "city"
    | "verification_status"
    | "is_public"
    | "is_featured"
    | "transport_available"
    | "created_at"
  >[];
}

export async function setOrganisationVerificationStatus(
  id: string,
  status: OrganisationRow["verification_status"],
) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("organisations")
    .update({ verification_status: status })
    .eq("id", id);
  if (error) throw error;
}

export async function setOrganisationFeatured(id: string, featured: boolean) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("organisations")
    .update({ is_featured: featured })
    .eq("id", id);
  if (error) throw error;
}

export async function listFeaturedOrganisations() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("organisations")
    .select("id, name, slug, org_type, city, country, logo_url")
    .eq("is_featured", true)
    .eq("verification_status", "approved")
    .eq("is_public", true);
  if (error) throw error;
  return data ?? [];
}
