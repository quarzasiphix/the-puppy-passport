import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Button } from "@/shared/ui/button";
import { useAuth } from "@/domains/identity";
import { getMyProfile, updateMyPhone } from "@/domains/identity";
import { NotificationPreferences } from "@/domains/messaging";
import { useTranslation } from "@/shared/i18n";

import { getFriendlyErrorMessage } from "@/shared/lib/errors";
export const Route = createFileRoute("/dashboard/foundation/settings")({
  component: SettingsPage,
});

const schema = z.object({ phone: z.string().optional() });
type FormValues = z.infer<typeof schema>;

function SettingsPage() {
  const { t } = useTranslation();
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const profileQuery = useQuery({
    queryKey: ["my-profile", userId],
    enabled: !!userId,
    queryFn: getMyProfile,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: profileQuery.data ? { phone: profileQuery.data.phone ?? "" } : undefined,
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => updateMyPhone(userId!, values.phone || null),
    onSuccess: () => {
      toast.success(t("foundationPanel.settingsPage.savedToast"));
      queryClient.invalidateQueries({ queryKey: ["my-profile", userId] });
    },
    onError: (err) =>
      toast.error(getFriendlyErrorMessage(err, t("foundationPanel.settingsPage.saveFailed"))),
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">
          {t("foundationPanel.settingsPage.title")}
        </h1>
      </header>
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <div className="rounded-2xl border border-border/70 bg-card p-6">
          <h3 className="mb-3 font-display text-lg font-semibold">
            {t("foundationPanel.settingsPage.accountTitle")}
          </h3>
          {profileQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">
              {t("foundationPanel.settingsPage.loading")}
            </p>
          ) : (
            <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-3">
              <div>
                <Label>{t("foundationPanel.settingsPage.emailLabel")}</Label>
                <Input value={profileQuery.data?.email ?? ""} disabled />
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("foundationPanel.settingsPage.emailChangeNote")}
                </p>
              </div>
              <div>
                <Label>{t("foundationPanel.settingsPage.phoneLabel")}</Label>
                <Input {...form.register("phone")} />
              </div>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending
                  ? t("foundationPanel.settingsPage.saving")
                  : t("foundationPanel.settingsPage.saveChanges")}
              </Button>
            </form>
          )}
        </div>
        <div className="rounded-2xl border border-border/70 bg-card p-6">
          <h3 className="mb-3 font-display text-lg font-semibold">
            {t("foundationPanel.settingsPage.notificationsTitle")}
          </h3>
          {userId && <NotificationPreferences userId={userId} />}
        </div>
      </div>
    </div>
  );
}
