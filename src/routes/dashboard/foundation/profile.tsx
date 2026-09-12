import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Label } from "@/shared/ui/label";
import { Badge } from "@/shared/ui/badge";
import { useAuth } from "@/domains/identity";
import { getMyFoundationProfile } from "@/domains/breeders";
import { updateKennel } from "@/domains/breeders";
import { useTranslation } from "@/shared/i18n";

import { getFriendlyErrorMessage } from "@/shared/lib/errors";
export const Route = createFileRoute("/dashboard/foundation/profile")({
  component: ProfilePage,
});

const schema = z.object({
  description: z.string().optional(),
  coverImageUrl: z.string().optional(),
  logoUrl: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  associationName: z.string().optional(),
  membershipNumber: z.string().optional(),
  responseTime: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

function ProfilePage() {
  const { t } = useTranslation();
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["my-foundation-profile", userId],
    enabled: !!userId,
    queryFn: () => getMyFoundationProfile(userId!),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: query.data
      ? {
          description: query.data.description ?? "",
          coverImageUrl: query.data.cover_image_url ?? "",
          logoUrl: query.data.logo_url ?? "",
          city: query.data.city ?? "",
          country: query.data.country ?? "",
          associationName: query.data.association_name ?? "",
          membershipNumber: query.data.membership_number ?? "",
          responseTime: query.data.response_time ?? "",
        }
      : undefined,
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (!query.data) throw new Error("Organisation not loaded");
      return updateKennel(query.data.id, {
        description: values.description || null,
        cover_image_url: values.coverImageUrl || null,
        logo_url: values.logoUrl || null,
        city: values.city || null,
        country: values.country || null,
        association_name: values.associationName || null,
        membership_number: values.membershipNumber || null,
        response_time: values.responseTime || null,
      });
    },
    onSuccess: () => {
      toast.success(t("foundationPanel.profileEditor.updatedToast"));
      queryClient.invalidateQueries({ queryKey: ["my-foundation-profile", userId] });
    },
    onError: (err) =>
      toast.error(getFriendlyErrorMessage(err, t("foundationPanel.profileEditor.saveFailed"))),
  });

  const v = form.watch();

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">
          {t("foundationPanel.profileEditor.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("foundationPanel.profileEditor.subtitle")}
        </p>
      </header>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">
          {t("foundationPanel.profileEditor.loading")}
        </p>
      ) : !query.data ? (
        <p className="text-sm text-muted-foreground">{t("foundationPanel.profileEditor.noOrg")}</p>
      ) : (
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-[1.3fr_1fr]">
          <div className="rounded-2xl border border-border/70 bg-card p-6">
            <h3 className="mb-3 font-display text-lg font-semibold">
              {t("foundationPanel.profileEditor.editCardTitle")}
            </h3>
            <form
              onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
              className="space-y-4"
            >
              <div>
                <Label>{t("foundationPanel.profileEditor.fieldDescription")}</Label>
                <Textarea rows={5} {...form.register("description")} />
              </div>
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                <div>
                  <Label>{t("foundationPanel.profileEditor.fieldCoverImageUrl")}</Label>
                  <Input placeholder="https://…" {...form.register("coverImageUrl")} />
                </div>
                <div>
                  <Label>{t("foundationPanel.profileEditor.fieldLogoUrl")}</Label>
                  <Input placeholder="https://…" {...form.register("logoUrl")} />
                </div>
                <div>
                  <Label>{t("foundationPanel.profileEditor.fieldCity")}</Label>
                  <Input {...form.register("city")} />
                </div>
                <div>
                  <Label>{t("foundationPanel.profileEditor.fieldCountry")}</Label>
                  <Input {...form.register("country")} />
                </div>
                <div>
                  <Label>{t("foundationPanel.profileEditor.fieldAssociation")}</Label>
                  <Input {...form.register("associationName")} />
                </div>
                <div>
                  <Label>{t("foundationPanel.profileEditor.fieldMembershipNumber")}</Label>
                  <Input {...form.register("membershipNumber")} />
                </div>
                <div>
                  <Label>{t("foundationPanel.profileEditor.fieldResponseTime")}</Label>
                  <Input
                    placeholder={t("foundationPanel.profileEditor.fieldResponseTimePlaceholder")}
                    {...form.register("responseTime")}
                  />
                </div>
              </div>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending
                  ? t("foundationPanel.profileEditor.saving")
                  : t("foundationPanel.profileEditor.saveChanges")}
              </Button>
              {query.data.verification_status !== "approved" && (
                <p className="text-xs text-muted-foreground">
                  {t("foundationPanel.profileEditor.notApprovedNote")}
                </p>
              )}
            </form>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card p-6">
            <h3 className="mb-3 font-display text-lg font-semibold">
              {t("foundationPanel.profileEditor.previewCardTitle")}
            </h3>
            <div className="overflow-hidden rounded-xl border border-border/70">
              <img
                src={v.coverImageUrl || "/images/seed/hero-breeder.jpg"}
                alt=""
                className="h-40 w-full object-cover"
              />
              <div className="p-4">
                <div className="flex items-center gap-2">
                  <div className="font-display text-lg font-semibold">{query.data.name}</div>
                  {query.data.verification_status === "approved" && (
                    <Badge className="bg-primary/90 text-primary-foreground">
                      {t("foundationPanel.profileEditor.verifiedBadge")}
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {v.city}, {v.country}
                  {v.responseTime
                    ? ` · ${t("foundationPanel.profileEditor.respondsPrefix")} ${v.responseTime}`
                    : ""}
                </div>
                <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
                  {v.description || t("foundationPanel.profileEditor.noDescriptionYet")}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
