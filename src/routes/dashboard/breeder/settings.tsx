import { useRef, useState } from "react";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, LogOut, Upload, Clock, CheckCircle2, XCircle } from "lucide-react";
import { Card } from "@/shared/ui/panel";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Label } from "@/shared/ui/label";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Switch } from "@/shared/ui/switch";
import { useAuth, signOut } from "@/domains/identity";
import { getMyProfile, updateMyPhone } from "@/domains/identity";
import { NotificationPreferences } from "@/domains/messaging";
import {
  getMyKennel,
  getMyKennelProfile,
  updateKennel,
  uploadKennelLogo,
  uploadKennelCoverPhoto,
  getKennelSiteConfiguration,
  updateKennelSiteConfiguration,
  getKennelCapabilities,
  getMyOrgVerification,
  uploadVerificationEvidence,
  getVerificationEvidenceUrl,
  KENNEL_SECTIONS,
  KENNEL_SECTION_LABELS,
  BREEDER_BRAND_PALETTE,
  type KennelSection,
  type KennelTheme,
} from "@/domains/breeders";
import { usePostHog } from "posthog-js/react";
import { useTranslation } from "@/shared/i18n";

import { getFriendlyErrorMessage } from "@/shared/lib/errors";
export const Route = createFileRoute("/dashboard/breeder/settings")({
  component: SettingsPage,
});

const schema = z.object({ phone: z.string().optional() });
type FormValues = z.infer<typeof schema>;

function SettingsPage() {
  const { userId } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const posthog = usePostHog();
  const [signingOut, setSigningOut] = useState(false);
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
      posthog.capture("account_phone_updated");
      toast.success("Saved.");
      queryClient.invalidateQueries({ queryKey: ["my-profile", userId] });
    },
    onError: (err) => toast.error(getFriendlyErrorMessage(err, "Could not save.")),
  });

  // Moved here from the header's account-menu dropdown (2026-09-13) — that menu is reachable from
  // every screen and every item in it is one tap, so "sign out" sat right next to "switch
  // workspace" with no extra friction. Living at the bottom of Settings instead means reaching it
  // takes a deliberate navigation, not an accidental tap.
  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    await queryClient.invalidateQueries({ queryKey: ["auth-state"] });
    await router.invalidate();
    toast.success(t("nav.signedOutToast"));
    await navigate({ to: "/" });
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">Settings</h1>
      </header>
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
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
          <KennelProfileEditor userId={userId} />
        </div>
        <div className="lg:col-span-2">
          <VerificationDocuments userId={userId} />
        </div>
        <div className="lg:col-span-2">
          <KennelPageSettings userId={userId} />
        </div>
        <div className="lg:col-span-2">
          <Card title={t("breederPanel.settingsDangerZone.title")}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-md text-sm text-muted-foreground">
                {t("breederPanel.settingsDangerZone.body")}
              </p>
              <Button
                type="button"
                variant="outline"
                className="gap-2 text-destructive hover:text-destructive"
                disabled={signingOut}
                onClick={handleSignOut}
              >
                <LogOut className="size-4" />
                {signingOut
                  ? t("breederPanel.settingsDangerZone.signingOut")
                  : t("breederPanel.settingsDangerZone.signOutButton")}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Merged into Settings from its own separate "/dashboard/breeder/profile" page (2026-09-13, at the
// product owner's request — "the settings should be the breeder editor, their logo") since that's
// exactly what this always was: the kennel's own bio/branding editor, just living one nav item
// away from where a breeder would expect it. That route is now deleted and its nav entry removed
// (see navigation.ts) — "View live profile" below links straight to the real public @handle page.
const profileSchema = z.object({
  description: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  associationName: z.string().optional(),
  membershipNumber: z.string().optional(),
  yearsExperience: z.coerce.number().min(0).optional(),
  responseTime: z.string().optional(),
});
type ProfileFormValues = z.infer<typeof profileSchema>;

function KennelProfileEditor({ userId }: { userId: string | null }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const posthog = usePostHog();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const query = useQuery({
    queryKey: ["my-kennel-profile", userId],
    enabled: !!userId,
    queryFn: () => getMyKennelProfile(userId!),
  });

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    values: query.data
      ? {
          description: query.data.description ?? "",
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
    mutationFn: (values: ProfileFormValues) => {
      if (!query.data) throw new Error("Kennel not loaded");
      return updateKennel(query.data.id, {
        description: values.description || null,
        city: values.city || null,
        country: values.country || null,
        association_name: values.associationName || null,
        membership_number: values.membershipNumber || null,
        years_experience: values.yearsExperience ?? null,
        response_time: values.responseTime || null,
      });
    },
    onSuccess: () => {
      posthog.capture("kennel_profile_updated");
      toast.success(t("breederPanel.profileEditor.updatedToast"));
      queryClient.invalidateQueries({ queryKey: ["my-kennel-profile", userId] });
    },
    onError: (err) =>
      toast.error(getFriendlyErrorMessage(err, t("breederPanel.profileEditor.saveFailed"))),
  });

  async function handleLogoChange(file: File) {
    if (!query.data) return;
    setUploadingLogo(true);
    try {
      const url = await uploadKennelLogo(query.data.id, file);
      await updateKennel(query.data.id, { logo_url: url });
      posthog.capture("kennel_logo_uploaded");
      toast.success(t("breederPanel.profileEditor.logoUpdatedToast"));
      queryClient.invalidateQueries({ queryKey: ["my-kennel-profile", userId] });
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err, t("breederPanel.profileEditor.uploadFailed")));
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleCoverChange(file: File) {
    if (!query.data) return;
    setUploadingCover(true);
    try {
      const url = await uploadKennelCoverPhoto(query.data.id, file);
      await updateKennel(query.data.id, { cover_image_url: url });
      posthog.capture("kennel_cover_photo_uploaded");
      toast.success(t("breederPanel.profileEditor.coverUpdatedToast"));
      queryClient.invalidateQueries({ queryKey: ["my-kennel-profile", userId] });
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err, t("breederPanel.profileEditor.uploadFailed")));
    } finally {
      setUploadingCover(false);
    }
  }

  if (query.isLoading) {
    return (
      <Card title={t("breederPanel.profileEditor.editCardTitle")}>
        <p className="text-sm text-muted-foreground">{t("breederPanel.profileEditor.loading")}</p>
      </Card>
    );
  }
  if (!query.data) {
    return (
      <Card title={t("breederPanel.profileEditor.editCardTitle")}>
        <p className="text-sm text-muted-foreground">{t("breederPanel.profileEditor.noKennel")}</p>
      </Card>
    );
  }

  const kennel = query.data;

  return (
    <Card
      title={t("breederPanel.profileEditor.editCardTitle")}
      cta={kennel.slug ? t("breederPanel.profileEditor.viewLiveProfile") : undefined}
      ctaTo={kennel.slug ? `/@${kennel.slug}` : undefined}
    >
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-[1.3fr_1fr]">
        <form
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          className="space-y-4"
        >
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            <div>
              <Label>{t("breederPanel.profileEditor.fieldLogo")}</Label>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) handleLogoChange(file);
                }}
              />
              <div className="mt-1 flex items-center gap-3">
                <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-border/70 bg-secondary/40">
                  {kennel.logo_url ? (
                    <img src={kennel.logo_url} alt="" className="size-full object-cover" />
                  ) : (
                    <Upload className="size-5 text-muted-foreground" />
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingLogo}
                  onClick={() => logoInputRef.current?.click()}
                >
                  {uploadingLogo
                    ? t("breederPanel.profileEditor.uploading")
                    : kennel.logo_url
                      ? t("breederPanel.profileEditor.changeButton")
                      : t("breederPanel.profileEditor.uploadButton")}
                </Button>
              </div>
            </div>
            <div>
              <Label>{t("breederPanel.profileEditor.fieldCover")}</Label>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) handleCoverChange(file);
                }}
              />
              <div className="mt-1 flex items-center gap-3">
                <div className="grid h-14 w-24 shrink-0 place-items-center overflow-hidden rounded-xl border border-border/70 bg-secondary/40">
                  {kennel.cover_image_url ? (
                    <img src={kennel.cover_image_url} alt="" className="size-full object-cover" />
                  ) : (
                    <Upload className="size-5 text-muted-foreground" />
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingCover}
                  onClick={() => coverInputRef.current?.click()}
                >
                  {uploadingCover
                    ? t("breederPanel.profileEditor.uploading")
                    : kennel.cover_image_url
                      ? t("breederPanel.profileEditor.changeButton")
                      : t("breederPanel.profileEditor.uploadButton")}
                </Button>
              </div>
            </div>
          </div>

          <div>
            <Label>{t("breederPanel.profileEditor.fieldDescription")}</Label>
            <Textarea rows={4} {...form.register("description")} />
          </div>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
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
          {kennel.verification_status !== "approved" && (
            <p className="text-xs text-muted-foreground">
              {t("breederPanel.profileEditor.notApprovedNote")}
            </p>
          )}
        </form>

        <div className="overflow-hidden rounded-xl border border-border/70">
          <img
            src={kennel.cover_image_url || "/images/seed/hero-breeder.jpg"}
            alt=""
            className="h-40 w-full object-cover"
          />
          <div className="p-4">
            <div className="flex items-center gap-2">
              {kennel.logo_url && (
                <img
                  src={kennel.logo_url}
                  alt=""
                  className="size-8 shrink-0 rounded-full border border-border object-cover"
                />
              )}
              <div className="font-display text-lg font-semibold">{kennel.name}</div>
              {kennel.verification_status === "approved" && (
                <Badge className="bg-primary/90 text-primary-foreground">
                  {t("breederPanel.profileEditor.verifiedBadge")}
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {form.watch("city")}
              {form.watch("city") && form.watch("country") ? ", " : ""}
              {form.watch("country")}
              {form.watch("responseTime")
                ? ` · ${t("breederPanel.profileEditor.respondsPrefix")} ${form.watch("responseTime")}`
                : ""}
            </div>
            <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
              {form.watch("description") || t("breederPanel.profileEditor.noDescriptionYet")}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

// Verification evidence (WNI, kennel-club registration proof, etc.) — the gap TODO.md tracked
// since 2026-09-12 ("No document-upload UI in breeder onboarding ... evidence_url exists in the
// schema but nothing ever writes to it"). Reuses user_verifications.evidence_url rather than a new
// document table (product owner, 2026-09-13) — see submit_verification_evidence() in
// supabase/migrations/20260913130000_verification_evidence_upload.sql for why this goes through an
// RPC instead of a direct table update, and why it's a private-bucket storage PATH, not a public
// URL, viewed only via a short-lived signed link generated on demand.
function VerificationDocuments({ userId }: { userId: string | null }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const posthog = usePostHog();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const query = useQuery({
    queryKey: ["my-org-verification", userId],
    enabled: !!userId,
    queryFn: () => getMyOrgVerification(userId!),
  });

  async function handleFileChange(file: File) {
    if (!userId || !query.data) return;
    setUploading(true);
    try {
      await uploadVerificationEvidence(userId, query.data.id, file);
      posthog.capture("verification_evidence_submitted");
      toast.success(t("breederPanel.verificationDocs.uploadedToast"));
      queryClient.invalidateQueries({ queryKey: ["my-org-verification", userId] });
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err, t("breederPanel.verificationDocs.uploadFailed")));
    } finally {
      setUploading(false);
    }
  }

  async function handleView() {
    if (!query.data?.evidence_url) return;
    try {
      const url = await getVerificationEvidenceUrl(query.data.evidence_url);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err, t("breederPanel.verificationDocs.uploadFailed")));
    }
  }

  if (query.isLoading) {
    return (
      <Card title={t("breederPanel.verificationDocs.title")}>
        <p className="text-sm text-muted-foreground">{t("breederPanel.profileEditor.loading")}</p>
      </Card>
    );
  }
  if (!query.data) {
    return (
      <Card title={t("breederPanel.verificationDocs.title")}>
        <p className="text-sm text-muted-foreground">
          {t("breederPanel.verificationDocs.noVerification")}
        </p>
      </Card>
    );
  }

  const v = query.data;
  const isClosed = ["approved", "rejected", "expired", "suspended"].includes(v.status);

  return (
    <Card title={t("breederPanel.verificationDocs.title")}>
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {t("breederPanel.verificationDocs.explain")}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 p-3">
          <div className="flex items-center gap-2">
            <StatusIcon status={v.status} />
            <span className="text-sm font-medium capitalize">{v.status.replace(/_/g, " ")}</span>
          </div>
          <div className="flex items-center gap-2">
            {v.evidence_url && (
              <Button type="button" variant="outline" size="sm" onClick={handleView}>
                {t("breederPanel.verificationDocs.viewButton")}
              </Button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) handleFileChange(file);
              }}
            />
            <Button
              type="button"
              size="sm"
              disabled={uploading || isClosed}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading
                ? t("breederPanel.verificationDocs.uploading")
                : v.evidence_url
                  ? t("breederPanel.verificationDocs.changeButton")
                  : t("breederPanel.verificationDocs.uploadButton")}
            </Button>
          </div>
        </div>
        {isClosed && (
          <p className="text-xs text-muted-foreground">
            {t("breederPanel.verificationDocs.closedNote")}
          </p>
        )}
      </div>
    </Card>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "approved") return <CheckCircle2 className="size-4 text-success" />;
  if (status === "rejected" || status === "suspended")
    return <XCircle className="size-4 text-destructive" />;
  return <Clock className="size-4 text-accent" />;
}

function KennelPageSettings({ userId }: { userId: string | null }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const posthog = usePostHog();
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
    onSuccess: (_data, patch) => {
      posthog.capture("kennel_site_config_updated", { changed_fields: Object.keys(patch) });
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
            <Label>{t("breederPanel.brandColor.settingLabel")}</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("breederPanel.brandColor.settingHint")}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!capabilities.canCustomizeTheme}
                onClick={() => mutation.mutate({ primaryColor: null })}
                aria-label={t("breederPanel.brandColor.none")}
                className={`flex size-10 items-center justify-center rounded-full border-2 bg-card disabled:cursor-not-allowed disabled:opacity-50 ${
                  !config.primaryColor ? "border-primary" : "border-border"
                }`}
              >
                {!config.primaryColor && <Check className="size-4 text-primary" />}
              </button>
              {BREEDER_BRAND_PALETTE.map((c) => {
                const selected = config.primaryColor?.toLowerCase() === c.hex.toLowerCase();
                return (
                  <button
                    key={c.key}
                    type="button"
                    disabled={!capabilities.canCustomizeTheme}
                    onClick={() => mutation.mutate({ primaryColor: c.hex })}
                    aria-label={t(c.labelKey)}
                    title={t(c.labelKey)}
                    style={{ backgroundColor: c.hex }}
                    className={`flex size-10 items-center justify-center rounded-full border-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                      selected ? "border-foreground" : "border-transparent"
                    }`}
                  >
                    {selected && <Check className="size-4 text-white" />}
                  </button>
                );
              })}
            </div>
            {!capabilities.canCustomizeTheme && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("breederPanel.brandColor.settingLocked")}
              </p>
            )}
          </div>

          <div>
            <Label>Sections shown on your public kennel page</Label>
            <div className="mt-2 grid gap-2 grid-cols-1 sm:grid-cols-2">
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
