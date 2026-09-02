import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Switch } from "@/shared/ui/switch";
import { Label } from "@/shared/ui/label";
import {
  listMyNotificationPreferences,
  notificationCategoryLabels,
  setNotificationPreference,
  type NotificationCategory,
} from "../services/notifications";

// Real preferences (Stage H) — only in-app exists as a channel in this app (no email/push delivery
// integration anywhere in the codebase), and only the categories with a real notifyUser() call
// site are offered, so nothing shown here is a fake/unwired toggle.
export function NotificationPreferences({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["notification-preferences", userId],
    queryFn: () => listMyNotificationPreferences(userId),
  });

  async function toggle(category: NotificationCategory, enabled: boolean) {
    try {
      await setNotificationPreference(userId, category, enabled);
      queryClient.invalidateQueries({ queryKey: ["notification-preferences", userId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update this preference.");
    }
  }

  if (query.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-3">
      {query.data?.map((pref) => (
        <div key={pref.category} className="flex items-center justify-between gap-3">
          <Label htmlFor={`notif-${pref.category}`} className="text-sm font-normal">
            {notificationCategoryLabels[pref.category]}
            {pref.category === "security" && (
              <span className="ml-2 text-xs text-muted-foreground">(always on)</span>
            )}
          </Label>
          <Switch
            id={`notif-${pref.category}`}
            checked={pref.in_app_enabled}
            disabled={pref.category === "security"}
            onCheckedChange={(checked) => toggle(pref.category, checked)}
          />
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        In-app only — Anemalo doesn't send email or push notifications yet.
      </p>
    </div>
  );
}
