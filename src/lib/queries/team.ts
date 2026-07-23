import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Database } from "@/lib/supabase/types";

// Stage E: organisation team/volunteer management
// (supabase/migrations/20260101007700_organisation_team_management.sql). Every mutation goes
// through a SECURITY DEFINER RPC (never a raw table insert/update/delete from this file) so the
// tier protections (only the true owner can touch an owner/administrator-role row) and audit
// logging live in one place, not duplicated per caller.

export type OrgMemberRole =
  Database["public"]["Tables"]["organisation_members"]["Row"]["member_role"];
export type OrgMemberStatus = Database["public"]["Tables"]["organisation_members"]["Row"]["status"];
export type OrgMemberRow = Database["public"]["Tables"]["organisation_members"]["Row"];
export type OrgInvitationRow = Database["public"]["Tables"]["organisation_invitations"]["Row"];

// Plain-language labels — never show a raw role/status enum value unexplained.
export const orgMemberRoleLabels: Record<OrgMemberRole, string> = {
  owner: "Owner",
  administrator: "Administrator",
  employee: "Employee",
  breeder: "Breeder",
  volunteer: "Volunteer",
  driver: "Driver",
  viewer: "Viewer",
  adoption_coordinator: "Adoption coordinator",
  transport_coordinator: "Transport coordinator",
  animal_care_member: "Animal-care team member",
};

export async function listOrgMembers(orgId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("organisation_members")
    .select("*, profiles(display_name, avatar_url)")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as (OrgMemberRow & {
    profiles: { display_name: string | null; avatar_url: string | null } | null;
  })[];
}

export async function listOrgInvitations(orgId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("organisation_invitations")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as OrgInvitationRow[];
}

export async function inviteOrgMember(input: {
  orgId: string;
  email: string;
  role: OrgMemberRole;
}): Promise<string> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("invite_org_member", {
    p_org_id: input.orgId,
    p_email: input.email,
    p_role: input.role,
  });
  if (error) throw error;
  return data as string;
}

export async function revokeOrgInvitation(invitationId: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.rpc("revoke_org_invitation", {
    p_invitation_id: invitationId,
  });
  if (error) throw error;
}

export async function removeOrgMember(memberId: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.rpc("remove_org_member", { p_member_id: memberId });
  if (error) throw error;
}

export async function setOrgMemberStatus(memberId: string, status: OrgMemberStatus) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.rpc("set_org_member_status", {
    p_member_id: memberId,
    p_status: status,
  });
  if (error) throw error;
}

export async function changeOrgMemberRole(memberId: string, newRole: OrgMemberRole) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.rpc("change_org_member_role", {
    p_member_id: memberId,
    p_new_role: newRole,
  });
  if (error) throw error;
}

export async function leaveOrganisation(orgId: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.rpc("leave_organisation", { p_org_id: orgId });
  if (error) throw error;
}

// --- Invitation acceptance (the invited person's side, not yet a member) ----------------------
export async function getInvitationPreview(token: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("get_invitation_by_token", { p_token: token });
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function acceptOrgInvitation(token: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.rpc("accept_org_invitation", { p_token: token });
  if (error) throw error;
}

export async function declineOrgInvitation(token: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.rpc("decline_org_invitation", { p_token: token });
  if (error) throw error;
}
