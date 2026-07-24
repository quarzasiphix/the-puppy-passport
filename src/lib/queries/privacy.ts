import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

// Real data export (GDPR Art. 20 portability) — every query here reads only the caller's own rows
// (enforced by RLS regardless of what this function requests), so this can never leak another
// user's data even if called incorrectly. Deliberately excludes: reporter identity on reports
// filed by others, internal moderation notes, another user's private data, and any organisation
// data not owned by the caller — none of those tables/columns are queried here at all, not just
// filtered after the fact. Messages are limited to non-internal ones (an ordinary user can never
// have sent an internal note anyway, per the is_internal lock in
// 20260101008600_messages_internal_flag_lock.sql, but this stays explicit rather than relying on
// that alone).
export async function exportMyData(userId: string) {
  const supabase = getSupabaseBrowserClient();
  const [
    profile,
    roles,
    transportRequests,
    reservations,
    applications,
    savedAnimals,
    waitlist,
    posts,
    sentMessages,
    notifications,
  ] = await Promise.all([
    supabase.rpc("get_my_profile"),
    supabase.from("user_roles").select("role, status, created_at").eq("user_id", userId),
    supabase
      .from("transport_requests")
      .select("request_number, status, pickup_country, destination_country, created_at")
      .eq("requester_profile_id", userId),
    supabase
      .from("reservations")
      .select("status, agreed_price, currency, created_at")
      .eq("buyer_id", userId),
    supabase
      .from("buyer_applications")
      .select("application_type, status, submitted_at")
      .eq("buyer_id", userId),
    supabase.from("saved_animals").select("animal_id, saved_at").eq("buyer_id", userId),
    supabase
      .from("route_waitlist")
      .select("origin_country, destination_country, status, created_at")
      .eq("profile_id", userId),
    supabase.from("posts").select("content, post_type, created_at").eq("author_profile_id", userId),
    supabase
      .from("messages")
      .select("conversation_id, body, message_kind, created_at")
      .eq("sender_profile_id", userId)
      .eq("is_internal", false),
    supabase
      .from("notifications")
      .select("notification_type, title, body, is_read, created_at")
      .eq("profile_id", userId),
  ]);

  return {
    exported_at: new Date().toISOString(),
    profile: profile.data ?? null,
    roles: roles.data ?? [],
    transport_requests: transportRequests.data ?? [],
    reservations: reservations.data ?? [],
    buyer_applications: applications.data ?? [],
    saved_animals: savedAnimals.data ?? [],
    route_waitlist_entries: waitlist.data ?? [],
    community_posts: posts.data ?? [],
    sent_messages: sentMessages.data ?? [],
    notifications: notifications.data ?? [],
  };
}

export async function getMyDeletionRequest(userId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("account_deletion_requests")
    .select("id, status, reason, requested_at")
    .eq("profile_id", userId)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function requestAccountDeletion(userId: string, reason: string | null) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("account_deletion_requests")
    .insert({ profile_id: userId, reason });
  if (error) throw error;
}

export type DeletionRequestRow = {
  id: string;
  profile_id: string;
  reason: string | null;
  status: "pending" | "processed" | "declined";
  requested_at: string;
  profiles: { display_name: string | null } | null;
};

// Deliberately doesn't select email here — authenticated's column grant on profiles excludes
// email/phone entirely (see 20260101003200_profiles_contact_lockdown.sql), including for admins;
// an admin who needs a user's contact details for a specific request looks it up directly in
// Supabase Studio rather than this app exposing a broader read path to everyone with the admin
// role, which would reopen the exact bulk-contact-harvesting issue that migration fixed.
export async function listDeletionRequests() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("account_deletion_requests")
    .select(
      "id, profile_id, reason, status, requested_at, profiles!account_deletion_requests_profile_id_fkey(display_name)",
    )
    .order("requested_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as DeletionRequestRow[];
}

export async function markDeletionRequestProcessed(
  id: string,
  status: "processed" | "declined",
  processedBy: string,
) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("account_deletion_requests")
    .update({ status, processed_at: new Date().toISOString(), processed_by: processedBy })
    .eq("id", id);
  if (error) throw error;
}
