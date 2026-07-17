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

export async function notifyUser(payload: {
  profileId: string;
  type: string;
  title: string;
  body?: string | null;
  linkUrl?: string | null;
}) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("notifications").insert({
    profile_id: payload.profileId,
    notification_type: payload.type,
    title: payload.title,
    body: payload.body ?? null,
    link_url: payload.linkUrl ?? null,
  });
  if (error) throw error;
}
