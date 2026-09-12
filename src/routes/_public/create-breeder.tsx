import { useEffect } from "react";
import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { usePostHog } from "posthog-js/react";
import {
  PawPrint,
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  Building2,
} from "lucide-react";
import { getFriendlyErrorMessage } from "@/shared/lib/errors";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Checkbox } from "@/shared/ui/checkbox";
import { useAuth, signupMethodSchema } from "@/domains/identity";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useTranslation } from "@/shared/i18n";

const orgTypeValues = ["kennel", "foundation", "shelter", "transport_company"] as const;

const searchSchema = z.object({
  // Lets a type-specific CTA (e.g. "List your kennel") skip straight past the client/org chooser
  // into the org-type onboarding form for a signed-in user.
  type: z.enum(orgTypeValues).optional(),
  // Google-only PostHog labeling hint for the signup_completed event, forwarded here by
  // auth.callback.tsx for a first-time OAuth/magic-link signup — see actions.ts.
  method: signupMethodSchema.optional(),
});

export const Route = createFileRoute("/_public/create-breeder")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Get started — Anemalo" }] }),
  component: CreateBreeder,
});

const orgTypeOptions = [
  { value: "kennel" as const, labelKey: "createBreederPage.orgTypeKennel" },
  { value: "foundation" as const, labelKey: "createBreederPage.orgTypeFoundation" },
  { value: "shelter" as const, labelKey: "createBreederPage.orgTypeShelter" },
  { value: "transport_company" as const, labelKey: "createBreederPage.orgTypeTransportCompany" },
];

const statusCopyKeys: Record<string, string> = {
  not_started: "createBreederPage.statusNotStarted",
  pending: "createBreederPage.statusPending",
  more_information_required: "createBreederPage.statusMoreInfo",
  approved: "createBreederPage.statusApproved",
  rejected: "createBreederPage.statusRejected",
  suspended: "createBreederPage.statusSuspended",
  expired: "createBreederPage.statusExpired",
};

const schema = z.object({
  orgType: z.enum(orgTypeValues),
  name: z.string().min(1, "Required"),
  city: z.string().min(1, "Required"),
  country: z.string().min(1, "Required"),
  associationName: z.string().optional(),
  membershipNumber: z.string().optional(),
  yearsExperience: z.coerce.number().min(0).optional(),
  breeds: z.string().optional(),
  website: z.string().optional(),
  description: z.string().min(1, "Tell us a little about your kennel or organisation"),
  // Foundation/shelter's KRS-style registration number, or a transport company's operator license
  // number — same organisations.registration_number column, different label per org type (see
  // orgTypeFieldConfig below). Not shown for kennel (association_name/membership_number already
  // cover kennel-club registration there).
  registrationNumber: z.string().optional(),
  // Transport-company only. Not passed to create_own_organisation (which has no matching
  // params) — international_transport_available maps to a real, existing organisations column,
  // set via a follow-up update right after creation succeeds (see onSubmit). Fleet size / license
  // number are deliberately NOT collected here, same call as this form already makes for a
  // kennel's "breeds" field (collected, never persisted) — real per-vehicle licensing belongs on
  // the Vehicles panel once the company is approved (a company may have several licenses, not one).
  internationalTransportAvailable: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;
type OrgType = FormValues["orgType"];

// A "kennel" application is verified as a breeder; foundation/shelter/transport-company
// applications share the generic "organisation" verification type — see
// supabase/migrations/*_user_verifications.sql.
function verificationTypeFor(orgType: OrgType) {
  return orgType === "kennel" ? ("breeder" as const) : ("organisation" as const);
}

function dashboardPathForOrgType(orgType: OrgType) {
  if (orgType === "kennel") return "/dashboard/breeder" as const;
  if (orgType === "transport_company") return "/dashboard/transport-company" as const;
  return "/dashboard/foundation" as const;
}

// Each org type asks for genuinely different information, not just a shared field set with one
// conditional section bolted on: a kennel's kennel-club association has nothing to do with a
// foundation's registration number, and neither has anything to do with a transport company's
// fleet. This map drives which sections/labels the onboarding form renders per type, keeping the
// JSX as one coherent form rather than a fork of near-duplicate components (three of the four
// types share most of their shape, so separate route files would mostly duplicate the
// pending-status/submit plumbing for no benefit).
const orgTypeFieldConfig: Record<
  OrgType,
  {
    showYearsField: boolean;
    yearsFieldLabelKey: string;
    showAssociationSection: boolean;
    showRegistrationSection: boolean;
    registrationNumberLabelKey: string;
    showFleetSection: boolean;
  }
> = {
  kennel: {
    showYearsField: true,
    yearsFieldLabelKey: "createBreederPage.fieldYears",
    showAssociationSection: true,
    showRegistrationSection: false,
    registrationNumberLabelKey: "",
    showFleetSection: false,
  },
  foundation: {
    showYearsField: true,
    yearsFieldLabelKey: "createBreederPage.fieldYearsOperating",
    showAssociationSection: false,
    showRegistrationSection: true,
    registrationNumberLabelKey: "createBreederPage.fieldRegistrationNumberOrg",
    showFleetSection: false,
  },
  shelter: {
    showYearsField: true,
    yearsFieldLabelKey: "createBreederPage.fieldYearsOperating",
    showAssociationSection: false,
    showRegistrationSection: true,
    registrationNumberLabelKey: "createBreederPage.fieldRegistrationNumberOrg",
    showFleetSection: false,
  },
  transport_company: {
    showYearsField: false,
    yearsFieldLabelKey: "",
    showAssociationSection: false,
    showRegistrationSection: true,
    registrationNumberLabelKey: "createBreederPage.fieldRegistrationNumberTransport",
    showFleetSection: true,
  },
};

function CreateBreeder() {
  const { userId, isLoading: authLoading } = useAuth();
  const posthog = usePostHog();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const router = useRouter();
  const { type: presetOrgType, method } = Route.useSearch();

  // The one-time signup_completed event for OAuth/magic-link signups: the password path already
  // fires this synchronously in signup.tsx's onSubmit, but a passwordless first-time user only
  // ever reaches this page via a server-side redirect (auth.callback.tsx / auth.confirm.tsx),
  // which can't call posthog itself. `method` rides along as a one-shot query param, consumed
  // here and stripped from the URL so a refresh can't replay it — same guard shape as the Stripe
  // return-flow param-strip on the buyer reservations page.
  useEffect(() => {
    if (!method) return;
    posthog.capture("signup_completed", { method });
    void navigate({ to: "/create-breeder", search: { type: presetOrgType }, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method]);

  const verificationQuery = useQuery({
    queryKey: ["my-org-verification", userId],
    enabled: !!userId,
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("user_verifications")
        .select("id, verification_type, status, submitted_data, notes, created_at")
        .eq("user_id", userId!)
        .in("verification_type", ["breeder", "organisation"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      orgType: presetOrgType ?? "kennel",
      name: "",
      city: "",
      country: "",
      associationName: "",
      membershipNumber: "",
      yearsExperience: undefined,
      breeds: "",
      website: "",
      description: "",
      registrationNumber: "",
      internationalTransportAvailable: false,
    },
  });

  // Submitting this form calls create_own_organisation(), which creates the organisation +
  // owner membership + an active role in one step — panel access is immediate — but leaves
  // verification_status/user_verifications.status at 'pending' until an admin reviews it via
  // approve_user_verification()/reject_user_verification(). See
  // docs/BREEDER_VERIFICATION_AND_TRUST.md. `breeds` is collected but not stored anywhere yet
  // (the RPC doesn't take it — no per-org "breeds" column; a kennel's breeds are derived from its
  // real parent_dogs once added).
  async function onSubmit(values: FormValues) {
    if (!userId) return;
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("create_own_organisation", {
      p_org_type: values.orgType,
      p_name: values.name,
      p_description: values.description,
      p_city: values.city || undefined,
      p_country: values.country || undefined,
      p_association_name: values.associationName || undefined,
      p_membership_number: values.membershipNumber || undefined,
      p_years_experience: values.yearsExperience ?? undefined,
      p_website: values.website || undefined,
      p_registration_number: values.registrationNumber || undefined,
    });
    if (error) {
      toast.error(getFriendlyErrorMessage(error, t("createBreederPage.couldNotSubmit")));
      return;
    }
    // create_own_organisation() has no transport-specific params — international_transport_
    // available is a real, existing organisations column, so it's set here via a follow-up
    // update instead of widening that RPC's signature for one boolean. Safe: the owner already
    // has UPDATE rights on their own just-created org row (the "owners update their own
    // organisation" RLS policy). Best-effort — never blocks the signup on failure.
    const orgId = data?.[0]?.organisation_id;
    if (orgId && values.orgType === "transport_company" && values.internationalTransportAvailable) {
      await supabase
        .from("organisations")
        .update({ international_transport_available: true })
        .eq("id", orgId);
    }
    posthog.capture("breeder_application_submitted", {
      org_type: values.orgType,
      verification_type: verificationTypeFor(values.orgType),
    });
    toast.success(t("createBreederPage.submittedToast"));
    await queryClient.invalidateQueries({ queryKey: ["auth-state"] });
    await queryClient.invalidateQueries({ queryKey: ["my-org-verification", userId] });
    // requireRole's dashboard guard reads context.auth, which comes from a router-loader-level
    // getCurrentUser() call — router.invalidate() is required (matches signin.tsx's own
    // sign-in -> navigate sequence) or the new role from the RPC above wouldn't be seen until
    // some later, unrelated navigation happened to re-run the loader.
    await router.invalidate();
    await navigate({ to: dashboardPathForOrgType(values.orgType) });
  }

  if (authLoading || (userId && verificationQuery.isLoading)) {
    return (
      <div className="container-page py-24 text-center text-muted-foreground">
        {t("createBreederPage.loading")}
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="container-page grid grid-cols-1 min-h-[60vh] place-items-center py-16 text-center">
        <div className="max-w-md">
          <PawPrint className="mx-auto size-8 text-primary" />
          <h1 className="mt-4 font-display text-3xl font-medium">
            {t("createBreederPage.noAccountTitle")}
          </h1>
          <p className="mt-2 text-muted-foreground">{t("createBreederPage.noAccountBody")}</p>
          <Button asChild size="lg" className="mt-6">
            <Link to="/signup">{t("createBreederPage.createAccount")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const verification = verificationQuery.data;

  if (verification) {
    const submittedName =
      (verification.submitted_data as { name?: string } | null)?.name ??
      t("createBreederPage.defaultAppName");
    // Panel access starts immediately at submission (create_own_organisation grants an active
    // role right away) and only ends if an admin actually rejects it — pending/more-info states
    // still have a working dashboard behind them, unlike approved-only access pre-2026-09-12.
    const hasDashboardAccess =
      verification.status !== "rejected" &&
      verification.status !== "suspended" &&
      verification.status !== "expired";
    const dashboardPath = dashboardPathForOrgType(
      ((verification.submitted_data as { org_type?: string } | null)?.org_type ??
        "foundation") as OrgType,
    );
    return (
      <div className="container-page py-14">
        <div className="mx-auto max-w-xl rounded-3xl border border-border/70 bg-card p-8 text-center">
          <StatusIcon status={verification.status} />
          <h1 className="mt-4 font-display text-2xl font-medium">{submittedName}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {statusCopyKeys[verification.status]
              ? t(statusCopyKeys[verification.status])
              : verification.status}
          </p>
          {hasDashboardAccess && (
            <Button asChild size="lg" className="mt-6">
              <Link to={dashboardPath}>{t("createBreederPage.goToDashboard")}</Link>
            </Button>
          )}
        </div>
      </div>
    );
  }

  // No verification/organisation yet — this is the real full-screen chooser. `presetOrgType`
  // (a type-specific CTA elsewhere in the app) skips straight to the org onboarding form;
  // otherwise the visitor picks "regular client" or "I run an organisation" first.
  if (!presetOrgType) {
    return (
      <AccountChooser
        onOrganisationChosen={() =>
          void navigate({ to: "/create-breeder", search: { type: "kennel" } })
        }
      />
    );
  }

  return <OrganisationOnboardingForm form={form} onSubmit={onSubmit} />;
}

function AccountChooser({ onOrganisationChosen }: { onOrganisationChosen: () => void }) {
  const { t } = useTranslation();
  const posthog = usePostHog();

  return (
    <div className="container-page grid grid-cols-1 min-h-[70vh] place-items-center py-16">
      <div className="w-full max-w-3xl text-center">
        <p className="text-xs font-medium uppercase tracking-wider text-accent">
          {t("createBreederPage.chooserEyebrow")}
        </p>
        <h1 className="mt-1 font-display text-4xl font-medium">
          {t("createBreederPage.chooserTitle")}
        </h1>
        <p className="mt-2 text-muted-foreground">{t("createBreederPage.chooserSubtitle")}</p>

        <div className="mt-8 grid gap-4 grid-cols-1 md:grid-cols-2">
          <Link
            to="/dashboard/buyer"
            onClick={() => posthog.capture("account_type_chosen", { choice: "client" })}
            className="group flex flex-col items-center rounded-3xl border border-border/70 bg-card p-8 text-center transition-colors hover:border-primary/50 hover:bg-secondary/40"
          >
            <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Search className="size-6" />
            </span>
            <span className="mt-4 font-display text-xl font-semibold">
              {t("createBreederPage.chooserClientTitle")}
            </span>
            <span className="mt-1 text-sm text-muted-foreground">
              {t("createBreederPage.chooserClientBody")}
            </span>
          </Link>

          <button
            type="button"
            onClick={() => {
              posthog.capture("account_type_chosen", { choice: "organisation" });
              onOrganisationChosen();
            }}
            className="group flex flex-col items-center rounded-3xl border border-border/70 bg-card p-8 text-center transition-colors hover:border-primary/50 hover:bg-secondary/40"
          >
            <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Building2 className="size-6" />
            </span>
            <span className="mt-4 font-display text-xl font-semibold">
              {t("createBreederPage.chooserOrgTitle")}
            </span>
            <span className="mt-1 text-sm text-muted-foreground">
              {t("createBreederPage.chooserOrgBody")}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

function OrganisationOnboardingForm({
  form,
  onSubmit,
}: {
  form: UseFormReturn<FormValues>;
  onSubmit: (values: FormValues) => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const orgType = form.watch("orgType");
  const config = orgTypeFieldConfig[orgType];

  return (
    <div className="container-page py-14">
      <div className="grid gap-10 grid-cols-1 lg:grid-cols-[1fr_360px]">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-accent">
            {t("createBreederPage.eyebrow")}
          </p>
          <h1 className="mt-1 font-display text-4xl font-medium">{t("createBreederPage.title")}</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">{t("createBreederPage.subtitle")}</p>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 space-y-6">
              <Section title={t("createBreederPage.sectionType")}>
                <div className="grid gap-2 grid-cols-1 md:grid-cols-3">
                  {orgTypeOptions.map((opt) => (
                    <button
                      type="button"
                      key={opt.value}
                      onClick={() => form.setValue("orgType", opt.value)}
                      className={`rounded-xl border p-3 text-sm font-medium transition-colors ${
                        orgType === opt.value
                          ? "border-primary bg-primary/5"
                          : "border-border bg-background hover:bg-secondary/50"
                      }`}
                    >
                      {t(opt.labelKey)}
                    </button>
                  ))}
                </div>
              </Section>

              <Section title={t("createBreederPage.sectionOrganisation")}>
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("createBreederPage.fieldName")}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {config.showYearsField && (
                    <FormField
                      control={form.control}
                      name="yearsExperience"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t(config.yearsFieldLabelKey)}</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("createBreederPage.fieldCity")}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("createBreederPage.fieldCountry")}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("createBreederPage.fieldWebsite")}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </Section>

              {config.showAssociationSection && (
                <Section title={t("createBreederPage.sectionAssociation")}>
                  <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="associationName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("createBreederPage.fieldAssociation")}</FormLabel>
                          <FormControl>
                            <Input placeholder="ZKwP / FCI" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="membershipNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("createBreederPage.fieldMembership")}</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="breeds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("createBreederPage.fieldBreeds")}</FormLabel>
                        <FormControl>
                          <Input placeholder="Golden Retriever, Labrador Retriever" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </Section>
              )}

              {config.showRegistrationSection && (
                <Section title={t("createBreederPage.sectionRegistration")}>
                  <FormField
                    control={form.control}
                    name="registrationNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t(config.registrationNumberLabelKey)}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </Section>
              )}

              {config.showFleetSection && (
                <Section title={t("createBreederPage.sectionFleet")}>
                  <FormField
                    control={form.control}
                    name="internationalTransportAvailable"
                    render={({ field }) => (
                      <FormItem>
                        <label className="flex items-center gap-2 text-sm">
                          <FormControl>
                            <Checkbox
                              checked={!!field.value}
                              onCheckedChange={(checked) => field.onChange(checked === true)}
                            />
                          </FormControl>
                          {t("createBreederPage.fieldInternationalTransport")}
                        </label>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("createBreederPage.fleetDetailNote")}
                  </p>
                </Section>
              )}

              <Section title={t("createBreederPage.sectionAbout")}>
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("createBreederPage.fieldDescription")}</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={5}
                          placeholder={t("createBreederPage.descriptionPlaceholder")}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </Section>

              <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? t("createBreederPage.submitting")
                  : t("createBreederPage.submit")}
              </Button>
            </form>
          </Form>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-border/70 bg-card p-6">
            <div className="flex items-center gap-2 text-primary">
              <ShieldCheck className="size-5" />
              <span className="text-sm font-semibold">
                {t("createBreederPage.sidebarChecksTitle")}
              </span>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>· {t("createBreederPage.check1")}</li>
              <li>· {t("createBreederPage.check2")}</li>
              <li>· {t("createBreederPage.check3")}</li>
              <li>· {t("createBreederPage.check4")}</li>
            </ul>
            <div className="mt-6 rounded-xl border border-border/70 bg-secondary/50 p-4">
              <div className="flex items-center gap-2">
                <PawPrint className="size-4 text-primary" />
                <span className="text-sm font-semibold">{t("createBreederPage.freeTitle")}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("createBreederPage.freeBody")}
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-6 space-y-4">
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "approved") return <CheckCircle2 className="mx-auto size-8 text-success" />;
  if (status === "rejected" || status === "suspended")
    return <XCircle className="mx-auto size-8 text-destructive" />;
  return <Clock className="mx-auto size-8 text-accent" />;
}
