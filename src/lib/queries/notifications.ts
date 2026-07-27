import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  notificationTemplates,
  type NotificationCategory,
  type NotificationTemplateId,
  type NotificationTemplatePayloads,
} from "@/lib/notification-templates";

export type { NotificationCategory } from "@/lib/notification-templates";

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
  // Stage CJR: an optional, caller-chosen key identifying the real-world event this notification
  // is *about* (e.g. "a specific review's approval", "a specific application's status change") —
  // when two calls for the same recipient share a dedup key (a retry, a double-click, a race), the
  // database returns the original notification instead of creating a duplicate. Omit for a
  // notification with no natural retry risk.
  dedupKey?: string | null;
  // Stage CJS: the version of the template that produced this title/body, recorded as an audit
  // trail (see src/lib/notification-templates.ts) — never re-resolved at read time, so it can never
  // cause a rendering failure for a reader of an already-stored notification.
  templateVersion?: number | null;
}) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.rpc("create_notification_if_enabled", {
    p_profile_id: payload.profileId,
    p_category: payload.category,
    p_notification_type: payload.type,
    p_title: payload.title,
    p_body: payload.body ?? undefined,
    p_link_url: payload.linkUrl ?? undefined,
    p_dedup_key: payload.dedupKey ?? undefined,
    p_template_version: payload.templateVersion ?? undefined,
  });
  if (error) throw error;
}

// Stage CJS: the templated path every real call site should use. Renders title/body/linkUrl
// deterministically from `notificationTemplates` (a pure function of `payload`, no ambient state)
// instead of constructing the strings inline at each call site, and stamps the exact template
// version that produced them. Stage YR-1: `category` is deliberately not a caller-suppliable
// argument here — it's read from the template definition itself, so a call site can never send a
// template under a mismatched preference category.
export async function notifyUserFromTemplate<T extends NotificationTemplateId>(args: {
  profileId: string;
  templateId: T;
  dedupKey?: string | null;
  payload: NotificationTemplatePayloads[T];
}) {
  const template = notificationTemplates[args.templateId];
  const render = template.render as (payload: NotificationTemplatePayloads[T]) => {
    title: string;
    body: string | null;
    linkUrl?: string | null;
  };
  const rendered = render(args.payload);
  await notifyUser({
    profileId: args.profileId,
    type: args.templateId,
    category: template.category,
    title: rendered.title,
    body: rendered.body,
    linkUrl: rendered.linkUrl ?? null,
    dedupKey: args.dedupKey,
    templateVersion: template.version,
  });
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
