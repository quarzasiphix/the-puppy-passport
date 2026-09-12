import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

// Resolves "my transport company" through organisation_members (active row, any member_role),
// not organisations.owner_user_id directly — that single column never grows to list co-owners
// added later, the same gap fixed for getMyKennel()/getMyKennelProfile() this session (see
// src/domains/animals/services/breeder.ts). foundation.ts's getMyFoundation() still has this bug;
// not fixed here — out of scope for this change, flagged separately.
async function getMyActiveOrgIds(userId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("organisation_members")
    .select("org_id")
    .eq("profile_id", userId)
    .eq("status", "active");
  if (error) throw error;
  return (data ?? []).map((m) => m.org_id);
}

export async function getMyTransportCompany(userId: string) {
  const orgIds = await getMyActiveOrgIds(userId);
  if (!orgIds.length) return null;
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("organisations")
    .select("id, name, verification_status")
    .in("id", orgIds)
    .eq("org_type", "transport_company")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getMyTransportCompanyProfile(userId: string) {
  const orgIds = await getMyActiveOrgIds(userId);
  if (!orgIds.length) return null;
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("organisations")
    .select(
      "id, name, slug, description, logo_url, city, country, international_transport_available, verification_status, is_public",
    )
    .in("id", orgIds)
    .eq("org_type", "transport_company")
    .maybeSingle();
  if (error) throw error;
  return data;
}
