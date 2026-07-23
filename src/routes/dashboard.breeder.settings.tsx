import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card } from "./dashboard.breeder.index";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { NotificationPreferences } from "@/components/notification-preferences";

export const Route = createFileRoute("/dashboard/breeder/settings")({
  component: SettingsPage,
});

const schema = z.object({ phone: z.string().optional() });
type FormValues = z.infer<typeof schema>;

function SettingsPage() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const profileQuery = useQuery({
    queryKey: ["my-profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.rpc("get_my_profile");
      if (error) throw error;
      return data;
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: profileQuery.data ? { phone: profileQuery.data.phone ?? "" } : undefined,
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("profiles")
        .update({ phone: values.phone || null })
        .eq("id", userId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved.");
      queryClient.invalidateQueries({ queryKey: ["my-profile", userId] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save."),
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">Settings</h1>
      </header>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Account">
          {profileQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-3">
              <div>
                <Label>Email</Label>
                <Input value={profileQuery.data?.email ?? ""} disabled />
                <p className="mt-1 text-xs text-muted-foreground">
                  Contact us to change the email on your account.
                </p>
              </div>
              <div>
                <Label>Phone</Label>
                <Input {...form.register("phone")} />
              </div>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving…" : "Save changes"}
              </Button>
            </form>
          )}
        </Card>
        <Card title="Notifications">{userId && <NotificationPreferences userId={userId} />}</Card>
      </div>
    </div>
  );
}
