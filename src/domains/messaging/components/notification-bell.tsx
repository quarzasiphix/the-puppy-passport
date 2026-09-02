import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { useAuth } from "@/domains/identity";
import {
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/notifications";

export function NotificationBell() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["my-notifications", userId],
    queryFn: () => listMyNotifications(userId!),
    enabled: !!userId,
    refetchInterval: 60_000,
  });

  const markRead = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-notifications", userId] }),
  });
  const markAllRead = useMutation({
    mutationFn: () => markAllNotificationsRead(userId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-notifications", userId] }),
  });

  if (!userId) return null;

  const notifications = query.data ?? [];
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border/60 p-3">
          <span className="text-sm font-medium">Notifications</span>
          {unreadCount > 0 && (
            <button
              className="text-xs text-primary hover:underline"
              onClick={() => markAllRead.mutate()}
            >
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">No notifications yet.</p>
          ) : (
            notifications.map((n) => {
              const content = (
                <div
                  className={`border-b border-border/40 p-3 text-sm last:border-0 ${n.is_read ? "" : "bg-accent/5"}`}
                  onClick={() => !n.is_read && markRead.mutate(n.id)}
                >
                  <div className="font-medium">{n.title}</div>
                  {n.body && <div className="mt-0.5 text-xs text-muted-foreground">{n.body}</div>}
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {new Date(n.created_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </div>
                </div>
              );
              return n.link_url ? (
                <a key={n.id} href={n.link_url} className="block hover:bg-secondary/50">
                  {content}
                </a>
              ) : (
                <div key={n.id} className="cursor-pointer hover:bg-secondary/50">
                  {content}
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
