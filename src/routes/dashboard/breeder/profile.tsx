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
import { Badge } from "@/shared/ui/badge";
import { Card } from "@/shared/ui/panel";
import { useAuth } from "@/domains/identity";
import { getMyKennelProfile, updateKennel } from "@/domains/breeders";
import { useTranslation } from "@/shared/i18n";

import { getFriendlyErrorMessage } from "@/shared/lib/errors";
export const Route = createFileRoute("/dashboard/breeder/profile")({
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
  yearsExperience: z.coerce.number().min(0).optional(),
  responseTime: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

function ProfilePage() {
  const { t } = useTranslation();
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["my-kennel-profile", userId],
    enabled: !!userId,
    queryFn: () => getMyKennelProfile(userId!),
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
          yearsExperience: query.data.years_experience ?? undefined,
          responseTime: query.data.response_time ?? "",
        }
      : undefined,
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (!query.data) throw new Error("Kennel not loaded");
      return updateKennel(query.data.id, {
        description: values.description || null,
        cover_image_url: values.coverImageUrl || null,
        logo_url: values.logoUrl || null,
        city: values.city || null,
        country: values.country || null,
        association_name: values.associationName || null,
        membership_number: values.membershipNumber || null,
        years_experience: values.yearsExperience ?? null,
        response_time: values.responseTime || null,
      });
    },
    onSuccess: () => {
      toast.success(t("breederPanel.profileEditor.updatedToast"));
      queryClient.invalidateQueries({ queryKey: ["my-kennel-profile", userId] });
    },
    onError: (err) =>
      toast.error(getFriendlyErrorMessage(err, t("breederPanel.profileEditor.saveFailed"))),
  });

  const v = form.watch();

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-medium">
            {t("breederPanel.profileEditor.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("breederPanel.profileEditor.subtitle")}
          </p>
        </div>
        {query.data?.slug && (
          <Button asChild variant="outline">
            <Link to="/@{$handle}" params={{ handle: query.data.slug }}>
              {t("breederPanel.profileEditor.viewLiveProfile")}
            </Link>
          </Button>
        )}
      </header>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">
          {t("breederPanel.profileEditor.loading")}
        </p>
      ) : !query.data ? (
        <p className="text-sm text-muted-foreground">
          {t("breederPanel.profileEditor.noKennel")}
        </p>
      ) : (
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-[1.3fr_1fr]">
          <Card title={t("breederPanel.profileEditor.editCardTitle")}>
            <form
              onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
              className="space-y-4"
            >
              <div>
                <Label>{t("breederPanel.profileEditor.fieldDescription")}</Label>
                <Textarea rows={5} {...form.register("description")} />
              </div>
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                <div>
                  <Label>{t("breederPanel.profileEditor.fieldCoverImageUrl")}</Label>
                  <Input placeholder="https://…" {...form.register("coverImageUrl")} />
                </div>
                <div>
                  <Label>{t("breederPanel.profileEditor.fieldLogoUrl")}</Label>
                  <Input placeholder="https://…" {...form.register("logoUrl")} />
                </div>
                <div>
                  <Label>{t("breederPanel.profileEditor.fieldCity")}</Label>
                  <Input {...form.register("city")} />
                </div>
                <div>
                  <Label>{t("breederPanel.profileEditor.fieldCountry")}</Label>
                  <Input {...form.register("country")} />
                </div>
                <div>
                  <Label>{t("breederPanel.profileEditor.fieldAssociation")}</Label>
                  <Input
                    placeholder={t("breederPanel.profileEditor.fieldAssociationPlaceholder")}
                    {...form.register("associationName")}
                  />
                </div>
                <div>
                  <Label>{t("breederPanel.profileEditor.fieldMembershipNumber")}</Label>
                  <Input {...form.register("membershipNumber")} />
                </div>
                <div>
                  <Label>{t("breederPanel.profileEditor.fieldYearsExperience")}</Label>
                  <Input type="number" min={0} {...form.register("yearsExperience")} />
                </div>
                <div>
                  <Label>{t("breederPanel.profileEditor.fieldResponseTime")}</Label>
                  <Input
                    placeholder={t("breederPanel.profileEditor.fieldResponseTimePlaceholder")}
                    {...form.register("responseTime")}
                  />
                </div>
              </div>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending
                  ? t("breederPanel.profileEditor.saving")
                  : t("breederPanel.profileEditor.saveChanges")}
              </Button>
              {query.data.verification_status !== "approved" && (
                <p className="text-xs text-muted-foreground">
                  {t("breederPanel.profileEditor.notApprovedNote")}
                </p>
              )}
            </form>
          </Card>

          <Card title={t("breederPanel.profileEditor.previewCardTitle")}>
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
                      {t("breederPanel.profileEditor.verifiedBadge")}
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {v.city}, {v.country}
                  {v.responseTime
                    ? ` · ${t("breederPanel.profileEditor.respondsPrefix")} ${v.responseTime}`
                    : ""}
                </div>
                <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
                  {v.description || t("breederPanel.profileEditor.noDescriptionYet")}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
