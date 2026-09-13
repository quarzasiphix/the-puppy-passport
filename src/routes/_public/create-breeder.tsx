import { useEffect, useRef, useState } from "react";
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
  Dog,
  HeartHandshake,
  Truck,
  Home,
  ArrowLeft,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getFriendlyErrorMessage } from "@/shared/lib/errors";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Checkbox } from "@/shared/ui/checkbox";
import { useAuth, signupMethodSchema } from "@/domains/identity";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useHydrated } from "@/shared/hooks/use-hydrated";
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

// Redesigned 2026-09-14: the org-type picker used to be four small text-only buttons squeezed
// into the top of an already-long form — the specific thing flagged as "looks ugly" and needing
// "icons for each selection to be grandma-proofed". Each type now gets its own icon, its own tone
// (reusing the app's existing primary/accent/success/warning tokens, not invented colors — just
// consistently mapped one-per-type so the four choices are visually distinct from a glance), and a
// plain-language one-line description, used both by the new full-screen OrgTypeChooser step below
// and by the small "you're registering as" banner at the top of the form itself.
type OrgTypeTone = "primary" | "accent" | "success" | "warning";

const orgTypeMeta: Record<
  (typeof orgTypeValues)[number],
  { icon: LucideIcon; tone: OrgTypeTone; labelKey: string; descriptionKey: string }
> = {
  kennel: {
    icon: Dog,
    tone: "primary",
    labelKey: "createBreederPage.orgTypeKennel",
    descriptionKey: "createBreederPage.orgTypeKennelDesc",
  },
  foundation: {
    icon: HeartHandshake,
    tone: "accent",
    labelKey: "createBreederPage.orgTypeFoundation",
    descriptionKey: "createBreederPage.orgTypeFoundationDesc",
  },
  shelter: {
    icon: Home,
    tone: "success",
    labelKey: "createBreederPage.orgTypeShelter",
    descriptionKey: "createBreederPage.orgTypeShelterDesc",
  },
  transport_company: {
    icon: Truck,
    tone: "warning",
    labelKey: "createBreederPage.orgTypeTransportCompany",
    descriptionKey: "createBreederPage.orgTypeTransportCompanyDesc",
  },
};

// Full class strings, `hover:` prefix included — Tailwind's build-time scanner only picks up
// complete, literal class tokens from source; a `` `hover:${tone.ring}` `` template concatenation
// at render time would silently produce zero CSS for every one of these; see NOTE.
const ORG_TYPE_TONE_CLASSES: Record<
  OrgTypeTone,
  { soft: string; text: string; hoverRing: string; solid: string }
> = {
  primary: {
    soft: "bg-primary/10",
    text: "text-primary",
    hoverRing: "hover:border-primary",
    solid: "bg-primary",
  },
  accent: {
    soft: "bg-accent/10",
    text: "text-accent",
    hoverRing: "hover:border-accent",
    solid: "bg-accent",
  },
  success: {
    soft: "bg-success/10",
    text: "text-success",
    hoverRing: "hover:border-success",
    solid: "bg-success",
  },
  warning: {
    soft: "bg-warning/15",
    text: "text-foreground",
    hoverRing: "hover:border-warning",
    solid: "bg-warning",
  },
};

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
  // Was required (min 1) — a real bug report (2026-09-14) traced the "empty description ->
  // error -> the whole form is lost" complaint not to this validation itself (RHF blocks
  // submission and shows an inline message, it never touches the page) but to a real, separate
  // hydration race this page never guarded against (see the `hydrated` prop below) — skipping
  // straight to Submit without filling this optional-feeling field made hitting that race more
  // likely simply by leaving less time for hydration to finish. Made optional anyway: forcing a
  // description before someone can even get panel access doesn't match the "onboarding never
  // gates on review" testing-phase decision (create_own_organisation() itself has no such
  // requirement — p_description is passed straight through).
  description: z.string().optional(),
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

// Real bug report (2026-09-14): leaving the page mid-application (a refresh, a browser crash, or
// stepping away to go find a registration number) lost everything typed, with no warning. Draft
// autosave to localStorage — scoped per signed-in user (`userId`), since this page is only ever
// reachable signed in, so a shared-device leak between two different accounts isn't a real risk —
// fixes that independently of the hydration-race bug above; either one on its own would have
// prevented the report, both together make it very hard to lose an in-progress application again.
const DRAFT_STORAGE_KEY_PREFIX = "anemalo:create-breeder-draft:";

function loadDraft(userId: string): Partial<FormValues> | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY_PREFIX + userId);
    return raw ? (JSON.parse(raw) as Partial<FormValues>) : null;
  } catch {
    // Private browsing / storage disabled / corrupted JSON — a lost draft is never worse than
    // today's behaviour, so this fails silently rather than blocking the page.
    return null;
  }
}

function saveDraft(userId: string, values: FormValues) {
  try {
    window.localStorage.setItem(DRAFT_STORAGE_KEY_PREFIX + userId, JSON.stringify(values));
  } catch {
    // Storage full/blocked — draft saving is a resilience nice-to-have, never worth surfacing an
    // error over or blocking the actual form.
  }
}

function clearDraft(userId: string) {
  try {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY_PREFIX + userId);
  } catch {
    // ignore
  }
}

function CreateBreeder() {
  const { userId, isLoading: authLoading } = useAuth();
  const posthog = usePostHog();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const router = useRouter();
  const hydrated = useHydrated();
  const { type: presetOrgType, method } = Route.useSearch();
  const restoredDraftFor = useRef<string | null>(null);
  // Redesigned flow (2026-09-14): "I run an organisation" no longer jumps straight into the
  // field-heavy form pre-set to "kennel" — it now opens its own dedicated, full-screen, icon-card
  // step (OrgTypeChooser) so picking Kennel/Foundation/Shelter/Transport company is a real,
  // deliberate decision instead of four small buttons buried at the top of the form. Local state,
  // not another `search` param: a type-specific marketing CTA (?type=kennel) must still skip both
  // steps entirely, exactly as before.
  const [pickingType, setPickingType] = useState(false);

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

  // Restore once per signed-in user, after hydration (reading localStorage during SSR/the first
  // client render would either be empty — server has no access to it — or, if done unguarded,
  // clobber the very defaultValues React just used to produce markup matching the server, causing
  // a hydration mismatch). A `restoredDraftFor` ref, not just an empty dependency array, guards
  // against re-running and re-clobbering the form if `userId` flips undefined -> real value ->
  // (briefly) undefined again during a fast auth-state refetch.
  useEffect(() => {
    if (!hydrated || !userId || restoredDraftFor.current === userId) return;
    restoredDraftFor.current = userId;
    const draft = loadDraft(userId);
    if (draft) form.reset({ ...form.getValues(), ...draft });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, userId]);

  // Autosave on every change — cheap enough for a form this size, and simpler/more reliable than
  // debouncing for what's ultimately a "don't lose this on an accidental refresh" safety net, not
  // a real-time sync feature.
  useEffect(() => {
    if (!userId) return;
    const subscription = form.watch((values) => saveDraft(userId, values as FormValues));
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // The "republish warning" — browsers only ever show their own generic "leave site? changes may
  // not be saved" text for beforeunload (no custom message is permitted by any modern browser,
  // regardless of what's assigned to returnValue), but that's exactly the right nudge for someone
  // about to close the tab or navigate away mid-application. Only armed while there's actually
  // something worth warning about, and only reachable at all past hydration (matches every other
  // guard on this page).
  useEffect(() => {
    if (!hydrated || !form.formState.isDirty) return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hydrated, form.formState.isDirty]);

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
      // p_description is a required string server-side (no default in create_own_organisation()'s
      // signature) — an empty string is a perfectly valid "no description given yet" value there,
      // so this just keeps the type honest rather than widening the RPC for an optional field.
      p_description: values.description || "",
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
    clearDraft(userId);
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

  // No verification/organisation yet. `presetOrgType` (a type-specific CTA elsewhere in the app,
  // e.g. "List your kennel") skips straight to the org onboarding form; otherwise the visitor
  // picks "regular client" or "I run an organisation" first, and — new — which kind of
  // organisation second, before ever seeing the detailed form.
  if (!presetOrgType && !pickingType) {
    return <AccountChooser onOrganisationChosen={() => setPickingType(true)} />;
  }

  if (!presetOrgType && pickingType) {
    return (
      <OrgTypeChooser
        onSelect={(type) => void navigate({ to: "/create-breeder", search: { type } })}
        onBack={() => setPickingType(false)}
      />
    );
  }

  return <OrganisationOnboardingForm form={form} onSubmit={onSubmit} hydrated={hydrated} />;
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

// Redesigned 2026-09-14 — see the field comment on `orgTypeMeta` above. Four big, unmistakably
// distinct cards (own icon, own color, one plain-language sentence each) instead of four small
// text buttons crammed into the top of the detailed form — the explicit "grandma-proofed" bar: a
// first-time visitor with no technical background should be able to tell at a glance which one is
// theirs without reading closely.
function OrgTypeChooser({
  onSelect,
  onBack,
}: {
  onSelect: (type: (typeof orgTypeValues)[number]) => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const posthog = usePostHog();

  return (
    <div className="container-page grid grid-cols-1 min-h-[70vh] place-items-center py-16">
      <div className="w-full max-w-4xl text-center">
        <button
          type="button"
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> {t("createBreederPage.orgTypeChooserBack")}
        </button>
        <p className="text-xs font-medium uppercase tracking-wider text-accent">
          {t("createBreederPage.orgTypeChooserEyebrow")}
        </p>
        <h1 className="mt-1 font-display text-4xl font-medium">
          {t("createBreederPage.orgTypeChooserTitle")}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {t("createBreederPage.orgTypeChooserSubtitle")}
        </p>

        <div className="mt-8 grid gap-4 grid-cols-1 sm:grid-cols-2">
          {orgTypeValues.map((value) => {
            const meta = orgTypeMeta[value];
            const tone = ORG_TYPE_TONE_CLASSES[meta.tone];
            return (
              <button
                key={value}
                type="button"
                onClick={() => {
                  posthog.capture("org_type_chosen", { org_type: value });
                  onSelect(value);
                }}
                className={`group flex flex-col items-center rounded-3xl border border-border/70 bg-card p-8 text-center transition-colors hover:bg-secondary/40 ${tone.hoverRing}`}
              >
                <span
                  className={`grid size-16 place-items-center rounded-2xl ${tone.soft} ${tone.text}`}
                >
                  <meta.icon className="size-8" />
                </span>
                <span className="mt-4 font-display text-xl font-semibold">{t(meta.labelKey)}</span>
                <span className="mt-1 text-sm text-muted-foreground">{t(meta.descriptionKey)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function OrganisationOnboardingForm({
  form,
  onSubmit,
  hydrated,
}: {
  form: UseFormReturn<FormValues>;
  onSubmit: (values: FormValues) => void | Promise<void>;
  /** Guards the submit button — see the top-level `useHydrated()` comment on CreateBreeder: a
   * plain HTML form is interactive (and its Submit button clickable) before React finishes
   * attaching the real onSubmit handler; clicking in that window falls through to the browser's
   * native, unhandled GET submission — a hard refresh that loses every typed value. This was the
   * actual cause of the "empty description -> error -> refresh -> lost everything" bug report
   * (2026-09-14): every other form in this app (signup.tsx, etc.) already guards its submit button
   * with `disabled={!hydrated}` for exactly this reason; this page never had. */
  hydrated: boolean;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const orgType = form.watch("orgType");
  const config = orgTypeFieldConfig[orgType];
  const meta = orgTypeMeta[orgType];
  const tone = ORG_TYPE_TONE_CLASSES[meta.tone];

  return (
    <div className="container-page py-14">
      <div className="grid gap-10 grid-cols-1 lg:grid-cols-[1fr_360px]">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-accent">
            {t("createBreederPage.eyebrow")}
          </p>
          <h1 className="mt-1 font-display text-4xl font-medium">{t("createBreederPage.title")}</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">{t("createBreederPage.subtitle")}</p>

          {/* Replaces the old four-tiny-buttons "Section Type" row — the actual choice already
              happened on OrgTypeChooser; this is a confirmation, with an easy way back if it was
              a mistake, not a second decision point. */}
          <div
            className={`mt-6 flex items-center gap-3 rounded-2xl border border-border/70 p-4 ${tone.soft}`}
          >
            <span
              className={`grid size-11 shrink-0 place-items-center rounded-xl bg-card ${tone.text}`}
            >
              <meta.icon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">
                {t("createBreederPage.registeringAsLabel")}
              </p>
              <p className="font-display text-lg font-semibold">{t(meta.labelKey)}</p>
            </div>
            <button
              type="button"
              onClick={() => void navigate({ to: "/create-breeder", search: {} })}
              className="shrink-0 text-sm font-medium text-primary hover:underline"
            >
              {t("createBreederPage.changeTypeLink")}
            </button>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-6">
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

              <Button type="submit" size="lg" disabled={!hydrated || form.formState.isSubmitting}>
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
