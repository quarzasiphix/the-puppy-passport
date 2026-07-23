import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export type NotificationRow = {
  id: string;
  notification_type: string;
  title: string;
  body: string | null;
  link_url: string | null;
  is_read: boolean;
  created_at: string;
};

export async function listMyNotifications(userId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, notification_type, title, body, link_url, is_read, created_at")
    .eq("profile_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data ?? []) as NotificationRow[];
}

export async function markNotificationRead(id: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("profile_id", userId)
    .eq("is_read", false);
  if (error) throw error;
}

export type NotificationCategory = "applications" | "adoption" | "moderation" | "security";

// Routes through create_notification_if_enabled() (Stage H,
// supabase/migrations/20260101008000_notification_preferences.sql) so every call site's
// notification respects the recipient's own preference for its category — evaluated once, in the
// database, rather than repeated (and potentially forgotten) at each of the four real call sites.
// 'security' is always sent regardless of preference; the other categories default to enabled when
// the recipient has never touched their settings, never silently going quiet.
export async function notifyUser(payload: {
  profileId: string;
  type: string;
  category: NotificationCategory;
  title: string;
  body?: string | null;
  linkUrl?: string | null;
}) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.rpc("create_notification_if_enabled", {
    p_profile_id: payload.profileId,
    p_category: payload.category,
    p_notification_type: payload.type,
    p_title: payload.title,
    p_body: payload.body ?? null,
    p_link_url: payload.linkUrl ?? null,
  });
  if (error) throw error;
}

export type NotificationPreferenceRow = {
  category: NotificationCategory;
  in_app_enabled: boolean;
};

export const notificationCategoryLabels: Record<NotificationCategory, string> = {
  applications: "Applications (purchase & adoption status updates)",
  adoption: "Private rehoming decisions",
  moderation: "Moderation decisions affecting you",
  security: "Security & account notices",
};

// One row per category the user has ever explicitly changed — categories with no row default to
// enabled (see get_notification_preference()'s own opt-out default), so this always returns a
// full set for the settings UI to render, filling in the default for anything not yet stored.
export async function listMyNotificationPreferences(
  userId: string,
): Promise<NotificationPreferenceRow[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("category, in_app_enabled")
    .eq("profile_id", userId);
  if (error) throw error;
  const stored = new Map((data ?? []).map((r) => [r.category, r.in_app_enabled]));
  return (Object.keys(notificationCategoryLabels) as NotificationCategory[]).map((category) => ({
    category,
    in_app_enabled: stored.get(category) ?? true,
  }));
}

export async function setNotificationPreference(
  userId: string,
  category: NotificationCategory,
  inAppEnabled: boolean,
) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("notification_preferences")
    .upsert(
      { profile_id: userId, category, in_app_enabled: inAppEnabled },
      { onConflict: "profile_id,category" },
    );
  if (error) throw error;
}
