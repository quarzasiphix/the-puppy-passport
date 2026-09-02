import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card } from "@/shared/ui/panel";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Switch } from "@/shared/ui/switch";
import { useAuth } from "@/domains/identity";
import { getMyProfile, updateMyPhone } from "@/domains/identity";
import { NotificationPreferences } from "@/domains/messaging";
import {
  getMyKennel,
  getKennelSiteConfiguration,
  updateKennelSiteConfiguration,
  getKennelCapabilities,
  KENNEL_SECTIONS,
  KENNEL_SECTION_LABELS,
  type KennelSection,
  type KennelTheme,
} from "@/domains/breeders";

import { getFriendlyErrorMessage } from "@/shared/lib/errors";
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
    queryFn: getMyProfile,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: profileQuery.data ? { phone: profileQuery.data.phone ?? "" } : undefined,
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => updateMyPhone(userId!, values.phone || null),
    onSuccess: () => {
      toast.success("Saved.");
      queryClient.invalidateQueries({ queryKey: ["my-profile", userId] });
    },
    onError: (err) => toast.error(getFriendlyErrorMessage(err, "Could not save.")),
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
        <div className="lg:col-span-2">
          <KennelPageSettings userId={userId} />
        </div>
      </div>
    </div>
  );
}

function KennelPageSettings({ userId }: { userId: string | null }) {
  const queryClient = useQueryClient();
  const kennelQuery = useQuery({
    queryKey: ["my-kennel-id", userId],
    enabled: !!userId,
    queryFn: () => getMyKennel(userId!),
  });
  const kennelId = kennelQuery.data?.id;

  const configQuery = useQuery({
    queryKey: ["kennel-site-config", kennelId],
    enabled: !!kennelId,
    queryFn: () => getKennelSiteConfiguration(kennelId!),
  });

  const mutation = useMutation({
    mutationFn: (patch: Parameters<typeof updateKennelSiteConfiguration>[1]) =>
      updateKennelSiteConfiguration(kennelId!, patch),
    onSuccess: () => {
      toast.success("Kennel page updated.");
      queryClient.invalidateQueries({ queryKey: ["kennel-site-config", kennelId] });
    },
    onError: (err) => toast.error(getFriendlyErrorMessage(err, "Could not save.")),
  });

  if (!kennelId) return null;
  const config = configQuery.data;
  const capabilities = getKennelCapabilities(
    kennelQuery.data?.plan === "pro" || kennelQuery.data?.plan === "website"
      ? kennelQuery.data.plan
      : "free",
  );

  function toggleSection(section: KennelSection, checked: boolean) {
    if (!config) return;
    const next = checked
      ? [...config.visibleSections, section]
      : config.visibleSections.filter((s) => s !== section);
    // Keep a stable, predictable order — reordering sections by drag is a later customization
    // phase (see docs/SOCIAL_DOMAIN.md "Portal customization").
    const ordered = KENNEL_SECTIONS.filter((s) => next.includes(s));
    mutation.mutate({ visibleSections: ordered, sectionOrder: ordered });
  }

  return (
    <Card title="Kennel page">
      {configQuery.isLoading || !config ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-5">
          <div>
            <Label>Theme</Label>
            <Select
              value={config.theme}
              disabled={!capabilities.canCustomizeTheme}
              onValueChange={(v) => mutation.mutate({ theme: v as KennelTheme })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="classic">Classic</SelectItem>
                <SelectItem value="editorial">Editorial</SelectItem>
                <SelectItem value="modern">Modern</SelectItem>
              </SelectContent>
            </Select>
            {!capabilities.canCustomizeTheme && (
              <p className="mt-1 text-xs text-muted-foreground">
                Available on Breeder Pro and above.
              </p>
            )}
          </div>

          <div>
            <Label>Sections shown on your public kennel page</Label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {KENNEL_SECTIONS.map((section) => (
                <label key={section} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={config.visibleSections.includes(section)}
                    onCheckedChange={(checked) => toggleSection(section, checked === true)}
                  />
                  {KENNEL_SECTION_LABELS[section]}
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/70 p-3">
            <div>
              <div className="text-sm font-medium">Show Anemalo branding</div>
              <p className="text-xs text-muted-foreground">
                {capabilities.canRemoveAnemaloBranding
                  ? "Turn off to present a fully white-labelled page."
                  : "Removing branding is available on the Kennel Website plan."}
              </p>
            </div>
            <Switch
              checked={config.showAnemaloBranding || !capabilities.canRemoveAnemaloBranding}
              disabled={!capabilities.canRemoveAnemaloBranding}
              onCheckedChange={(checked) => mutation.mutate({ showAnemaloBranding: checked })}
            />
          </div>
        </div>
      )}
    </Card>
  );
}
