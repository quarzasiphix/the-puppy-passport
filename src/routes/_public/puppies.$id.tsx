import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  MapPin,
  Calendar,
  ShieldCheck,
  Truck,
  Heart,
  MessageCircle,
  ChevronLeft,
  Award,
  FileText,
  Syringe,
  Stethoscope,
  BadgeCheck,
  Info,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Separator } from "@/shared/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/ui/tabs";
import { Input } from "@/shared/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/shared/ui/tooltip";
import {
  getKennelById,
  getLitterById,
  getLitterParents,
  getPuppyById,
  type ParentDogInfo,
} from "@/domains/marketplace";
import { ApplyDialog } from "@/domains/marketplace";
import placeholderImg from "@/assets/puppy-1.jpg";
import { calculateEstimate, type PricingBreakdown } from "@/domains/transport";
import { findLikelyRouteMatch } from "@/domains/transport";
import {
  statusStyles,
  statusLabelFor,
  useIsSaved,
  formatExperience,
  formatPuppiesAvailable,
  formatDate,
} from "@/domains/marketplace";
import { ReportDialog } from "@/domains/trust";
import { useAuth } from "@/domains/identity";
import { startApplicationConversation } from "@/domains/messaging";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { applicationStatusLabels, type ApplicationStatus } from "@/domains/marketplace";
import { useTranslation } from "@/shared/i18n";

import { getFriendlyErrorMessage } from "@/shared/lib/errors";
export const Route = createFileRoute("/_public/puppies/$id")({
  loader: async ({ params }) => {
    const puppy = await getPuppyById(params.id).catch(() => null);
    if (!puppy) throw notFound();
    const [litter, parents, breeder] = await Promise.all([
      puppy.litterId ? getLitterById(puppy.litterId).catch(() => null) : Promise.resolve(null),
      puppy.litterId
        ? getLitterParents(puppy.litterId).catch(() => ({ mother: null, father: null }))
        : Promise.resolve({ mother: null, father: null }),
      puppy.breederId ? getKennelById(puppy.breederId).catch(() => null) : Promise.resolve(null),
    ]);
    return { puppy, litter, parents, breeder };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.puppy.name} — ${loaderData.puppy.breed} — Anemalo`
          : "Puppy — Anemalo",
      },
      {
        name: "description",
        content: loaderData
          ? `${loaderData.puppy.name}, a ${loaderData.puppy.breed} puppy from ${loaderData.puppy.kennel} in ${loaderData.puppy.city}, ${loaderData.puppy.country}.`
          : "A puppy listing on Anemalo.",
      },
    ],
  }),
  component: PuppyDetail,
});

// English placeholder for a parent dog with no data on file — kept static since it's used as a
// loader-independent default, and the visible label is re-derived below in ParentCard for the
// current locale via t("puppyDetail.notOnFile") when this default is in play.
const emptyParent: ParentDogInfo = {
  name: "Not on file",
  pedigree: "",
  image: "",
  tests: [],
  titles: "",
  description: "",
};

function PuppyDetail() {
  const { puppy, litter, parents, breeder } = Route.useLoaderData();
  const { isSaved, toggle: toggleSaved, pending: savePending } = useIsSaved(puppy.id);
  const { isSignedIn, userId } = useAuth();
  const { t, locale } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [active, setActive] = useState(0);
  const [openApply, setOpenApply] = useState(false);
  const existingApplicationQuery = useQuery({
    queryKey: ["my-puppy-application", puppy.id, userId],
    enabled: !!userId,
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("buyer_applications")
        .select("id, status")
        .eq("animal_id", puppy.id)
        .eq("buyer_id", userId!)
        .neq("status", "withdrawn")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const [destination, setDestination] = useState("");
  const [estimate, setEstimate] = useState<PricingBreakdown | null>(null);
  const [routeMatch, setRouteMatch] = useState(false);
  const [estimating, setEstimating] = useState(false);

  const askBreederMutation = useMutation({
    mutationFn: () => startApplicationConversation(puppy.id),
    onSuccess: (conversationId) => {
      navigate({ to: "/dashboard/buyer/messages", search: { conversation: conversationId } });
    },
    onError: (err) => {
      if (err instanceof Error && err.message.includes("application")) {
        toast.error(t("puppyDetail.applyFirstToAsk"));
        return;
      }
      toast.error(getFriendlyErrorMessage(err, t("puppyDetail.couldNotStartConversation")));
    },
  });

  async function handleEstimate() {
    if (!destination.trim()) return;
    setEstimating(true);
    try {
      const [result, match] = await Promise.all([
        calculateEstimate({
          pickupCountry: puppy.country,
          destinationCountry: destination.trim(),
          sizeCategory: "medium",
          serviceType: "recommend_best",
        }),
        findLikelyRouteMatch(destination.trim()),
      ]);
      setEstimate(result);
      setRouteMatch(!!match);
    } finally {
      setEstimating(false);
    }
  }

  if (!litter || !breeder) {
    return (
      <div className="container-page py-24 text-center">
        <p className="text-muted-foreground">{t("puppyDetail.missingInfo")}</p>
        <Button asChild className="mt-4">
          <Link to="/find-a-dog">{t("puppyDetail.backToSearch")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={100}>
      <div className="container-page py-6">
        <Link
          to="/find-a-dog"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> {t("puppyDetail.backToResults")}
        </Link>

        <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
          <div>
            <div className="overflow-hidden rounded-3xl border border-border/70 bg-card">
              <div className="aspect-[4/3] bg-secondary">
                <img
                  src={puppy.gallery[active]}
                  alt={puppy.name}
                  className="size-full object-cover"
                />
              </div>
              <div className="flex gap-2 p-3">
                {puppy.gallery.map((g, i) => (
                  <button
                    key={i}
                    onClick={() => setActive(i)}
                    className={`aspect-square w-20 overflow-hidden rounded-lg border-2 ${active === i ? "border-primary" : "border-transparent"}`}
                  >
                    <img src={g} alt="" className="size-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            <Tabs defaultValue="about" className="mt-8">
              <TabsList className="w-full justify-start overflow-x-auto">
                <TabsTrigger value="about">{t("puppyDetail.tabAbout")}</TabsTrigger>
                <TabsTrigger value="litter">{t("puppyDetail.tabLitter")}</TabsTrigger>
                <TabsTrigger value="parents">{t("puppyDetail.tabParents")}</TabsTrigger>
                <TabsTrigger value="health">{t("puppyDetail.tabHealth")}</TabsTrigger>
                <TabsTrigger value="breeder">{t("puppyDetail.tabBreeder")}</TabsTrigger>
                <TabsTrigger value="transport">{t("puppyDetail.tabTransport")}</TabsTrigger>
              </TabsList>

              <TabsContent value="about" className="mt-6 space-y-4">
                <SectionCard title={t("puppyDetail.aboutTitle")}>
                  <p className="text-muted-foreground">
                    {puppy.about || t("puppyDetail.noDescription")}
                  </p>
                  {(puppy.temperament || puppy.idealHome) && (
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {puppy.temperament && (
                        <div className="rounded-xl border border-border/70 bg-background p-4">
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">
                            {t("puppyDetail.temperament")}
                          </div>
                          <div className="mt-1 font-medium">{puppy.temperament}</div>
                        </div>
                      )}
                      {puppy.idealHome && (
                        <div className="rounded-xl border border-border/70 bg-background p-4">
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">
                            {t("puppyDetail.idealHome")}
                          </div>
                          <div className="mt-1 font-medium">{puppy.idealHome}</div>
                        </div>
                      )}
                    </div>
                  )}
                </SectionCard>
              </TabsContent>

              <TabsContent value="litter" className="mt-6">
                <SectionCard title={t("puppyDetail.litterInfoTitle")}>
                  <dl className="grid grid-cols-2 gap-4 md:grid-cols-3">
                    {[
                      [t("puppyDetail.litterCode"), litter.code],
                      [t("puppyDetail.born"), formatDate(locale, litter.birthDate, {})],
                      [t("puppyDetail.totalPuppies"), `${litter.puppyCount}`],
                      [t("puppyDetail.availableNow"), `${litter.available}`],
                      [t("puppyDetail.reserved"), `${litter.reserved}`],
                      [t("puppyDetail.registration"), litter.registration],
                    ].map(([label, d]) => (
                      <div key={label as string}>
                        <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                          {label}
                        </dt>
                        <dd className="mt-0.5 font-medium">{d}</dd>
                      </div>
                    ))}
                  </dl>
                </SectionCard>
              </TabsContent>

              <TabsContent value="parents" className="mt-6 grid gap-4 md:grid-cols-2">
                <ParentCard p={parents.mother ?? emptyParent} label={t("cards.mother")} />
                <ParentCard p={parents.father ?? emptyParent} label={t("cards.father")} />
              </TabsContent>

              <TabsContent value="health" className="mt-6">
                <SectionCard title={t("puppyDetail.healthTitle")}>
                  <p className="mb-4 text-sm text-muted-foreground">{t("puppyDetail.healthIntro")}</p>
                  <ul className="grid gap-3 md:grid-cols-2">
                    {[
                      { icon: BadgeCheck, label: t("puppyDetail.docMicrochip") },
                      { icon: Syringe, label: t("puppyDetail.docVaccinations") },
                      { icon: Stethoscope, label: t("puppyDetail.docDeworming") },
                      { icon: FileText, label: t("puppyDetail.docHealthBook") },
                      { icon: Award, label: t("puppyDetail.docPedigree") },
                      { icon: FileText, label: t("puppyDetail.docSalesAgreement") },
                      { icon: Stethoscope, label: t("puppyDetail.docParentHealthTests") },
                    ].map((i) => (
                      <li
                        key={i.label}
                        className="flex items-center gap-3 rounded-xl border border-border/70 bg-background p-3"
                      >
                        <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                          <i.icon className="size-4" />
                        </span>
                        <span className="flex-1 text-sm font-medium">{i.label}</span>
                      </li>
                    ))}
                  </ul>
                </SectionCard>
              </TabsContent>

              <TabsContent value="breeder" className="mt-6">
                <SectionCard title={t("puppyDetail.breederTitle")}>
                  <div className="flex items-start gap-4">
                    <img src={breeder.cover} alt="" className="size-24 rounded-xl object-cover" />
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-display text-lg font-semibold">{breeder.kennel}</h4>
                        {breeder.verified && (
                          <Badge className="bg-primary/90 text-primary-foreground">
                            <ShieldCheck className="mr-1 size-3" /> {t("cards.verified")}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {breeder.name} · {breeder.city}, {breeder.country}
                      </p>
                      <p className="mt-2 text-sm">{breeder.description}</p>
                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {breeder.responseTime && (
                          <span>
                            {t("puppyDetail.responsePrefix")}: {breeder.responseTime}
                          </span>
                        )}
                        {breeder.years > 0 && <span>{formatExperience(locale, breeder.years)}</span>}
                        <span>{formatPuppiesAvailable(locale, breeder.availablePuppies)}</span>
                      </div>
                      <Button asChild variant="outline" size="sm" className="mt-4">
                        <Link to="/@$handle" params={{ handle: breeder.slug }}>
                          {t("puppyDetail.viewKennelProfile")}
                        </Link>
                      </Button>
                    </div>
                  </div>
                </SectionCard>
              </TabsContent>

              <TabsContent value="transport" className="mt-6">
                <SectionCard title={t("puppyDetail.transportEstimateTitle")}>
                  <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                    <div>
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t("puppyDetail.destinationCountry")}
                      </label>
                      <Input
                        placeholder={t("puppyDetail.destinationPlaceholder")}
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                      />
                    </div>
                    <Button onClick={handleEstimate} disabled={estimating || !destination.trim()}>
                      {estimating ? t("puppyDetail.calculating") : t("puppyDetail.estimate")}
                    </Button>
                  </div>
                  {estimate && (
                    <div className="mt-5 rounded-xl border border-border/70 bg-background p-4">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <div className="text-xs text-muted-foreground">
                            {t("puppyDetail.estimatedPrice")}
                          </div>
                          <div className="font-display text-xl font-semibold">
                            {estimate.currency} {estimate.low} – {estimate.high}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">{t("puppyDetail.from")}</div>
                          <div className="font-medium">
                            {puppy.country || t("puppyDetail.notSet")}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">{t("puppyDetail.to")}</div>
                          <div className="font-medium">{destination}</div>
                        </div>
                      </div>
                      {routeMatch && (
                        <p className="mt-3 text-sm text-success">
                          {t("puppyDetail.routeMatchHint")}
                        </p>
                      )}
                      <p className="mt-3 text-xs text-muted-foreground">
                        {t("puppyDetail.estimateDisclaimer")}
                      </p>
                    </div>
                  )}
                </SectionCard>
              </TabsContent>
            </Tabs>
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
              <div className="flex flex-wrap gap-1.5">
                <Badge className={statusStyles[puppy.status]}>{statusLabelFor(t, puppy.status)}</Badge>
                {puppy.verified && (
                  <Badge className="bg-primary/90 text-primary-foreground">
                    <ShieldCheck className="mr-1 size-3" /> {t("cards.verifiedBreeder")}
                  </Badge>
                )}
              </div>
              <h1 className="mt-3 font-display text-3xl font-medium">{puppy.name}</h1>
              <p className="text-muted-foreground">
                {puppy.breed} · {puppy.sex} · {puppy.color}
              </p>

              <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <Field
                  icon={<Calendar className="size-4" />}
                  label={t("puppyDetail.dateOfBirth")}
                  value={formatDate(locale, puppy.dob, {})}
                />
                <Field
                  icon={<Calendar className="size-4" />}
                  label={t("puppyDetail.ready")}
                  value={formatDate(locale, puppy.readyDate, {})}
                />
                <Field
                  icon={<MapPin className="size-4" />}
                  label={t("puppyDetail.location")}
                  value={`${puppy.city}, ${puppy.country}`}
                />
                <Field
                  icon={<Truck className="size-4" />}
                  label={t("cards.transport")}
                  value={
                    puppy.transportAvailable
                      ? t("puppyDetail.transportAvailable")
                      : t("puppyDetail.transportNotOffered")
                  }
                />
              </dl>

              <Separator className="my-5" />

              <div>
                <div className="font-display text-3xl font-semibold">
                  {puppy.pricePLN.toLocaleString()} PLN
                </div>
                <div className="text-sm text-muted-foreground">
                  ≈ €{puppy.priceEUR.toLocaleString()}
                </div>
              </div>

              <div className="mt-5 space-y-2">
                {existingApplicationQuery.data ? (
                  <Button className="w-full" size="lg" variant="outline" asChild>
                    <Link to="/dashboard/buyer/applications">
                      {t("puppyDetail.applicationSentPrefix")}{" "}
                      {applicationStatusLabels[
                        existingApplicationQuery.data.status as ApplicationStatus
                      ] ?? t("puppyDetail.viewStatus")}
                    </Link>
                  </Button>
                ) : (
                  <Button className="w-full" size="lg" onClick={() => setOpenApply(true)}>
                    {t("puppyDetail.applyForPuppy")}
                  </Button>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="lg"
                    disabled={askBreederMutation.isPending}
                    onClick={() =>
                      isSignedIn
                        ? askBreederMutation.mutate()
                        : toast.info(t("puppyDetail.signInToAsk"))
                    }
                  >
                    <MessageCircle className="mr-1 size-4" /> {t("puppyDetail.askBreeder")}
                  </Button>
                  <Button variant="outline" size="lg" asChild>
                    <Link to="/transport/request" search={{ animalId: puppy.id }}>
                      <Truck className="mr-1 size-4" /> {t("cards.transport")}
                    </Link>
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  className="w-full"
                  disabled={savePending}
                  onClick={toggleSaved}
                >
                  <Heart className={`mr-1 size-4 ${isSaved ? "fill-current text-accent" : ""}`} />
                  {isSaved ? t("puppyDetail.saved") : t("puppyDetail.saveListing")}
                </Button>
                <div className="text-center">
                  <ReportDialog
                    targetType="animal_listing"
                    targetId={puppy.id}
                    triggerLabel={t("puppyDetail.reportListing")}
                  />
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-border/70 bg-secondary/50 p-3 text-xs text-muted-foreground">
                <div className="flex items-start gap-2">
                  <Info className="mt-0.5 size-3.5 shrink-0" />
                  <span>{t("puppyDetail.noDirectSaleNotice")}</span>
                </div>
              </div>

              {(breeder.verified ||
                breeder.association ||
                litter.registration !== "Not registered yet") && (
                <div className="mt-5 border-t border-border/60 pt-4">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("puppyDetail.verificationLevels")}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      breeder.verified ? t("puppyDetail.kennelVerified") : null,
                      breeder.association
                        ? `${t("puppyDetail.associationPrefix")}: ${breeder.association}`
                        : null,
                      litter.registration !== "Not registered yet"
                        ? t("puppyDetail.litterRegistered")
                        : null,
                    ]
                      .filter((v): v is string => !!v)
                      .map((v) => (
                        <Tooltip key={v}>
                          <TooltipTrigger asChild>
                            <Badge variant="secondary" className="cursor-help">
                              <ShieldCheck className="mr-1 size-3 text-primary" />
                              {v}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[220px]">
                            {t("puppyDetail.verificationTooltip")}
                          </TooltipContent>
                        </Tooltip>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
      <ApplyDialog
        open={openApply}
        onOpenChange={setOpenApply}
        puppyName={puppy.name}
        animalId={puppy.id}
        litterId={puppy.litterId || null}
        organizationId={puppy.breederId || null}
        onSubmitted={() =>
          queryClient.invalidateQueries({ queryKey: ["my-puppy-application", puppy.id, userId] })
        }
      />
    </TooltipProvider>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-6">
      <h3 className="mb-4 font-display text-xl font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-xs text-muted-foreground">
        {icon} {label}
      </dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}

function ParentCard({ p, label }: { p: ParentDogInfo; label: string }) {
  const { t } = useTranslation();
  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
      <img
        src={p.image || placeholderImg}
        alt={p.name}
        className="aspect-[4/3] w-full object-cover"
      />
      <div className="p-5">
        <div className="text-xs uppercase tracking-wide text-accent">{label}</div>
        <h4 className="mt-1 font-display text-lg font-semibold">
          {p.name === "Not on file" ? t("puppyDetail.notOnFile") : p.name}
        </h4>
        <p className="text-xs text-muted-foreground">{p.pedigree}</p>
        {p.description && <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>}
        {p.tests.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {p.tests.map((t) => (
              <Badge key={t} variant="secondary">
                {t}
              </Badge>
            ))}
          </div>
        )}
        {p.titles && (
          <p className="mt-3 text-sm">
            <strong>{t("puppyDetail.titlesPrefix")}: </strong>
            {p.titles}
          </p>
        )}
      </div>
    </div>
  );
}
