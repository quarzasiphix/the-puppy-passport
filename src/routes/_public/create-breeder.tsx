import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PawPrint, ShieldCheck, Clock, CheckCircle2, XCircle } from "lucide-react";
import { getFriendlyErrorMessage } from "@/shared/lib/errors";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { useAuth } from "@/domains/identity";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useTranslation } from "@/shared/i18n";

export const Route = createFileRoute("/_public/create-breeder")({
  head: () => ({ meta: [{ title: "Apply for verification — Anemalo" }] }),
  component: CreateBreeder,
});

const orgTypeOptions = [
  { value: "kennel" as const, labelKey: "createBreederPage.orgTypeKennel" },
  { value: "foundation" as const, labelKey: "createBreederPage.orgTypeFoundation" },
  { value: "shelter" as const, labelKey: "createBreederPage.orgTypeShelter" },
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
  orgType: z.enum(["kennel", "foundation", "shelter"]),
  name: z.string().min(1, "Required"),
  city: z.string().min(1, "Required"),
  country: z.string().min(1, "Required"),
  associationName: z.string().optional(),
  membershipNumber: z.string().optional(),
  yearsExperience: z.coerce.number().min(0).optional(),
  breeds: z.string().optional(),
  website: z.string().optional(),
  description: z.string().min(1, "Tell us a little about your kennel or organisation"),
});

type FormValues = z.infer<typeof schema>;

// A "kennel" application is verified as a breeder; foundation/shelter applications share the
// generic "organisation" verification type — see supabase/migrations/*_user_verifications.sql.
function verificationTypeFor(orgType: FormValues["orgType"]) {
  return orgType === "kennel" ? ("breeder" as const) : ("organisation" as const);
}

function CreateBreeder() {
  const { userId, isLoading: authLoading } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const router = useRouter();

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
      orgType: "kennel",
      name: "",
      city: "",
      country: "",
      associationName: "",
      membershipNumber: "",
      yearsExperience: undefined,
      breeds: "",
      website: "",
      description: "",
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
    const { error } = await supabase.rpc("create_own_organisation", {
      p_org_type: values.orgType,
      p_name: values.name,
      p_description: values.description,
      p_city: values.city || undefined,
      p_country: values.country || undefined,
      p_association_name: values.associationName || undefined,
      p_membership_number: values.membershipNumber || undefined,
      p_years_experience: values.yearsExperience ?? undefined,
      p_website: values.website || undefined,
    });
    if (error) {
      toast.error(getFriendlyErrorMessage(error, t("createBreederPage.couldNotSubmit")));
      return;
    }
    toast.success(t("createBreederPage.submittedToast"));
    await queryClient.invalidateQueries({ queryKey: ["auth-state"] });
    await queryClient.invalidateQueries({ queryKey: ["my-org-verification", userId] });
    // requireRole's dashboard guard reads context.auth, which comes from a router-loader-level
    // getCurrentUser() call — router.invalidate() is required (matches signin.tsx's own
    // sign-in -> navigate sequence) or the new breeder role from the RPC above wouldn't be seen
    // until some later, unrelated navigation happened to re-run the loader.
    await router.invalidate();
    await navigate({ to: values.orgType === "kennel" ? "/dashboard/breeder" : "/dashboard/foundation" });
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
    const dashboardPath =
      (verification.submitted_data as { org_type?: string } | null)?.org_type === "kennel"
        ? "/dashboard/breeder"
        : "/dashboard/foundation";
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
                        form.watch("orgType") === opt.value
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
                  <FormField
                    control={form.control}
                    name="yearsExperience"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("createBreederPage.fieldYears")}</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
              </Section>

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
