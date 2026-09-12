import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Label } from "@/shared/ui/label";
import { Checkbox } from "@/shared/ui/checkbox";
import { useAuth } from "@/domains/identity";
import { getMyTransportCompanyProfile, updateKennel } from "@/domains/breeders";
import { getFriendlyErrorMessage } from "@/shared/lib/errors";
import { useTranslation } from "@/shared/i18n";

export const Route = createFileRoute("/dashboard/transport-company/profile")({
  component: ProfilePage,
});

const schema = z.object({
  description: z.string().optional(),
  logoUrl: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  internationalTransportAvailable: z.boolean().optional(),
});
type FormValues = z.infer<typeof schema>;

function ProfilePage() {
  const { t } = useTranslation();
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["my-transport-company-profile", userId],
    enabled: !!userId,
    queryFn: () => getMyTransportCompanyProfile(userId!),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: query.data
      ? {
          description: query.data.description ?? "",
          logoUrl: query.data.logo_url ?? "",
          city: query.data.city ?? "",
          country: query.data.country ?? "",
          internationalTransportAvailable: query.data.international_transport_available ?? false,
        }
      : undefined,
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (!query.data) throw new Error("Organisation not loaded");
      return updateKennel(query.data.id, {
        description: values.description || null,
        logo_url: values.logoUrl || null,
        city: values.city || null,
        country: values.country || null,
        international_transport_available: values.internationalTransportAvailable ?? false,
      });
    },
    onSuccess: () => {
      toast.success(t("transportCompanyPanel.profileEditor.updatedToast"));
      queryClient.invalidateQueries({ queryKey: ["my-transport-company-profile", userId] });
    },
    onError: (err) =>
      toast.error(
        getFriendlyErrorMessage(err, t("transportCompanyPanel.profileEditor.saveFailed")),
      ),
  });

  return (
    <div>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium">
            {t("transportCompanyPanel.profileEditor.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("transportCompanyPanel.profileEditor.subtitle")}
          </p>
        </div>
        {query.data?.slug && query.data.is_public && (
          <Button asChild variant="outline" size="sm">
            <Link to="/@{$handle}" params={{ handle: query.data.slug }}>
              {t("transportCompanyPanel.profileEditor.viewLiveProfile")}
            </Link>
          </Button>
        )}
      </header>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">
          {t("transportCompanyPanel.profileEditor.loading")}
        </p>
      ) : !query.data ? (
        <p className="text-sm text-muted-foreground">
          {t("transportCompanyPanel.profileEditor.noCompany")}
        </p>
      ) : (
        <div className="max-w-xl rounded-2xl border border-border/70 bg-card p-6">
          <h3 className="mb-3 font-display text-lg font-semibold">
            {t("transportCompanyPanel.profileEditor.editCardTitle")}
          </h3>
          <form
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            className="space-y-4"
          >
            <div>
              <Label>{t("transportCompanyPanel.profileEditor.fieldDescription")}</Label>
              <Textarea rows={5} {...form.register("description")} />
            </div>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              <div>
                <Label>{t("transportCompanyPanel.profileEditor.fieldLogoUrl")}</Label>
                <Input placeholder="https://…" {...form.register("logoUrl")} />
              </div>
              <div>
                <Label>{t("transportCompanyPanel.profileEditor.fieldCity")}</Label>
                <Input {...form.register("city")} />
              </div>
              <div>
                <Label>{t("transportCompanyPanel.profileEditor.fieldCountry")}</Label>
                <Input {...form.register("country")} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={!!form.watch("internationalTransportAvailable")}
                onCheckedChange={(checked) =>
                  form.setValue("internationalTransportAvailable", checked === true)
                }
              />
              {t("transportCompanyPanel.profileEditor.fieldInternationalTransport")}
            </label>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending
                ? t("transportCompanyPanel.profileEditor.saving")
                : t("transportCompanyPanel.profileEditor.saveChanges")}
            </Button>
            {query.data.verification_status !== "approved" && (
              <p className="text-xs text-muted-foreground">
                {t("transportCompanyPanel.profileEditor.notApprovedNote")}
              </p>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
