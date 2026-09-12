import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Truck,
  Route as RouteIcon,
  ShieldCheck,
  HeartHandshake,
  FileCheck2,
  Stethoscope,
  ChevronRight,
  Users,
  Zap,
  Crown,
  Package,
  GitBranch,
  Heart,
  Sparkles,
  PawPrint,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { PuppyCard, LitterCard, BreederCard } from "@/domains/marketplace";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  listPublishedPuppies,
  listPublishedLitters,
  listApprovedKennels,
} from "@/domains/marketplace";
import { ActionLauncher } from "@/app/components/action-launcher";
import { useTranslation } from "@/shared/i18n";
import transportImg from "@/assets/transport.jpg";

export const Route = createFileRoute("/_public/")({
  loader: async () => {
    const supabase = getSupabaseBrowserClient();
    const [orgs, animals, litters, featuredPuppies, upcomingLitters, verifiedBreeders] =
      await Promise.all([
        supabase
          .from("organisations")
          .select("*", { count: "exact", head: true })
          .eq("verification_status", "approved")
          .eq("is_public", true),
        supabase
          .from("animals")
          .select("*", { count: "exact", head: true })
          .eq("is_published", true)
          .in("availability_status", ["available", "applications_open"]),
        supabase
          .from("litters")
          .select("*", { count: "exact", head: true })
          .eq("is_published", true)
          .eq("status", "planned"),
        listPublishedPuppies(),
        listPublishedLitters("planned"),
        listApprovedKennels(),
      ]);
    return {
      verifiedOrgs: orgs.count ?? 0,
      availableAnimals: animals.count ?? 0,
      plannedLitters: litters.count ?? 0,
      featuredPuppies: featuredPuppies.slice(0, 6),
      upcomingLitters: upcomingLitters.slice(0, 3),
      verifiedBreeders: verifiedBreeders.slice(0, 4),
    };
  },
  component: Home,
});

function Home() {
  // Animal discovery and the marketplace come first — Anemalo is a dedicated animal ecosystem,
  // not a transport company with a marketplace bolted on (see docs/PRODUCT_VISION.md). Transport
  // is a major advantage of the platform, not its primary identity, so its sections appear after
  // the animal-discovery content, not before it.
  return (
    <div>
      <Hero />
      <ForBreedersBanner />
      <ActionLauncher variant="homepage" />
      <Trust />
      <FeaturedPuppies />
      <VerifiedBreeders />
      <UpcomingLitters />
      <FollowTheJourney />
      <Pedigrees />
      <ServiceCategories />
      <TransportSection />
      <HowItWorksStrip />
      <FinalCTA />
    </div>
  );
}

function Hero() {
  const { verifiedOrgs, availableAnimals, plannedLitters: plannedCount } = Route.useLoaderData();
  const { t } = useTranslation();
  return (
    <section className="relative overflow-hidden border-b border-border/60 bg-secondary/40">
      <div className="container-page grid gap-10 py-14 grid-cols-1 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:py-20">
        <div className="flex flex-col justify-center">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            <HeartHandshake className="size-3.5" /> {t("home.heroEyebrow")}
          </span>
          <h1 className="mt-4 font-display text-4xl font-medium leading-[1.05] tracking-tight text-foreground sm:text-5xl md:text-6xl">
            {t("home.heroTitlePrefix")}{" "}
            <span className="italic text-primary">{t("home.heroTitleHighlight")}</span>
            {t("home.heroTitleSuffix")}
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">{t("home.heroSubtitle")}</p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="h-12 gap-1">
              <Link to="/find-a-dog">
                {t("home.findADog")} <ChevronRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 gap-1">
              <Link to="/breeders">
                {t("home.meetBreeders")} <Users className="size-4" />
              </Link>
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {[
              [t("home.dogsForAdoption"), "/adoptions"],
              [t("home.foundationsRescues"), "/foundations"],
              [t("home.requestTransport"), "/transport/request"],
              [t("home.plannedRoutes"), "/planned-routes"],
            ].map(([label, href]) => (
              <Link
                key={label}
                to={href}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                {label} <ChevronRight className="size-3" />
              </Link>
            ))}
          </div>

          <dl className="mt-10 grid max-w-md grid-cols-3 gap-6 border-t border-border/60 pt-6 text-sm">
            <Stat label={t("home.statVerifiedBreeders")} value={String(verifiedOrgs)} />
            <Stat label={t("home.statAvailablePuppies")} value={String(availableAnimals)} />
            <Stat label={t("home.statPlannedLitters")} value={String(plannedCount)} />
          </dl>
        </div>

        <div className="relative">
          <div className="absolute -left-6 -top-6 hidden size-64 rounded-full bg-accent/10 blur-3xl lg:block" />
          {/* A color panel, not a stock/AI photo — on-brand (primary → accent, the site's own
              palette) and never looks like a bad generated image, unlike the hero photo this
              replaced. */}
          <div className="relative aspect-[4/5] size-full overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-primary via-primary/85 to-accent shadow-xl">
            <div
              className="absolute -right-10 -top-10 size-56 rounded-full bg-white/10"
              aria-hidden
            />
            <div
              className="absolute -bottom-16 -left-10 size-64 rounded-full bg-white/10"
              aria-hidden
            />
            <div className="absolute inset-0 grid place-items-center">
              <PawPrint className="size-32 text-white/20" strokeWidth={1} aria-hidden />
            </div>
          </div>
          <div className="absolute -bottom-6 -left-6 hidden max-w-xs rounded-2xl border border-border/70 bg-card p-4 shadow-lg md:block">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <Truck className="size-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">{t("home.heroCardCities")}</p>
                <p className="text-xs text-muted-foreground">{t("home.heroCardRouteStatus")}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{t("home.heroCardDocsStatus")}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="font-display text-2xl font-semibold text-foreground">{value}</dd>
    </div>
  );
}

// A compact, high-visibility strip right under the hero — the redesign brief is explicit that
// Anemalo is a two-sided platform and the breeder side needs to read as clearly as the buyer side,
// not be buried at the very bottom of the page behind everything else.
function ForBreedersBanner() {
  const { t } = useTranslation();
  return (
    <section className="border-b border-border/60 bg-primary/5">
      <div className="container-page flex flex-wrap items-center justify-between gap-4 py-4">
        <p className="text-sm">
          <span className="font-semibold text-primary">{t("home.forBreedersEyebrow")}</span>
          <span className="text-muted-foreground"> — {t("home.forBreedersBannerDesc")}</span>
        </p>
        <Button asChild size="sm" variant="outline" className="shrink-0">
          <Link to="/create-breeder" search={{ type: "kennel" }}>
            {t("home.forBreedersBannerCta")} <ChevronRight className="ml-1 size-3.5" />
          </Link>
        </Button>
      </div>
    </section>
  );
}

function ServiceCategories() {
  const { t } = useTranslation();
  const categories = [
    {
      icon: Package,
      title: t("home.serviceCategories.sharedTitle"),
      desc: t("home.serviceCategories.sharedDesc"),
    },
    {
      icon: Truck,
      title: t("home.serviceCategories.individualTitle"),
      desc: t("home.serviceCategories.individualDesc"),
    },
    {
      icon: Zap,
      title: t("home.serviceCategories.expressTitle"),
      desc: t("home.serviceCategories.expressDesc"),
    },
    {
      icon: Crown,
      title: t("home.serviceCategories.vipTitle"),
      desc: t("home.serviceCategories.vipDesc"),
    },
  ];
  return (
    <section className="container-page py-16">
      <SectionHeader
        eyebrow={t("home.serviceCategories.eyebrow")}
        title={t("home.serviceCategories.title")}
        desc={t("home.serviceCategories.desc")}
        cta={{ label: t("home.serviceCategories.cta"), to: "/transport" }}
      />
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        {categories.map((c) => (
          <div key={c.title} className="rounded-2xl border border-border/70 bg-card p-6">
            <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <c.icon className="size-5" />
            </div>
            <h3 className="mt-4 font-display text-lg font-semibold">{c.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{c.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Trust() {
  const { t } = useTranslation();
  const items = [
    {
      icon: ShieldCheck,
      label: t("home.trust.verifiedLabel"),
      desc: t("home.trust.verifiedDesc"),
    },
    {
      icon: FileCheck2,
      label: t("home.trust.documentsLabel"),
      desc: t("home.trust.documentsDesc"),
    },
    {
      icon: Stethoscope,
      label: t("home.trust.healthLabel"),
      desc: t("home.trust.healthDesc"),
    },
    {
      icon: HeartHandshake,
      label: t("home.trust.applicationsLabel"),
      desc: t("home.trust.applicationsDesc"),
    },
    {
      icon: Truck,
      label: t("home.trust.transportLabel"),
      desc: t("home.trust.transportDesc"),
    },
  ];
  return (
    <section className="border-y border-border/60 bg-background">
      <div className="container-page grid gap-6 py-10 grid-cols-1 md:grid-cols-5">
        {items.map((it) => (
          <div key={it.label} className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/8 text-primary">
              <it.icon className="size-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">{it.label}</div>
              <div className="text-xs text-muted-foreground">{it.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SectionHeader({
  eyebrow,
  title,
  desc,
  cta,
}: {
  eyebrow: string;
  title: string;
  desc?: string;
  cta?: { label: string; to: string };
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-wider text-accent">{eyebrow}</p>
        <h2 className="mt-2 font-display text-3xl font-medium tracking-tight md:text-4xl">
          {title}
        </h2>
        {desc && <p className="mt-2 text-muted-foreground">{desc}</p>}
      </div>
      {cta && (
        <Button asChild variant="outline">
          <Link to={cta.to}>
            {cta.label} <ChevronRight className="ml-1 size-4" />
          </Link>
        </Button>
      )}
    </div>
  );
}

function FeaturedPuppies() {
  const { featuredPuppies } = Route.useLoaderData();
  const { t } = useTranslation();
  if (featuredPuppies.length === 0) return null;
  return (
    <section className="container-page py-16">
      <SectionHeader
        eyebrow={t("home.featuredPuppies.eyebrow")}
        title={t("home.featuredPuppies.title")}
        desc={t("home.featuredPuppies.desc")}
        cta={{ label: t("home.featuredPuppies.cta"), to: "/find-a-dog" }}
      />
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {featuredPuppies.map((p) => (
          <PuppyCard key={p.id} p={p} />
        ))}
      </div>
    </section>
  );
}

function UpcomingLitters() {
  const { upcomingLitters } = Route.useLoaderData();
  const { t } = useTranslation();
  if (upcomingLitters.length === 0) return null;
  return (
    <section className="border-y border-border/60 bg-secondary/40 py-16">
      <div className="container-page">
        <SectionHeader
          eyebrow={t("home.upcomingLitters.eyebrow")}
          title={t("home.upcomingLitters.title")}
          desc={t("home.upcomingLitters.desc")}
          cta={{ label: t("home.upcomingLitters.cta"), to: "/planned-litters" }}
        />
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
          {upcomingLitters.map((l) => (
            <LitterCard key={l.id} l={l} planned />
          ))}
        </div>
      </div>
    </section>
  );
}

function VerifiedBreeders() {
  const { verifiedBreeders } = Route.useLoaderData();
  const { t } = useTranslation();
  if (verifiedBreeders.length === 0) return null;
  return (
    <section className="container-page py-16">
      <SectionHeader
        eyebrow={t("home.verifiedBreedersSection.eyebrow")}
        title={t("home.verifiedBreedersSection.title")}
        desc={t("home.verifiedBreedersSection.desc")}
        cta={{ label: t("home.verifiedBreedersSection.cta"), to: "/breeders" }}
      />
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        {verifiedBreeders.map((b) => (
          <BreederCard key={b.id} b={b} />
        ))}
      </div>
    </section>
  );
}

// Explains the breeder-profile + puppy-alumni model in plain terms — the redesign brief's
// "Follow the journey" section. No new data fetch needed here: this is homepage positioning
// copy about a real, already-built feature (@{$handle}.tsx), not a preview of fabricated data.
function FollowTheJourney() {
  const { t } = useTranslation();
  return (
    <section className="border-y border-border/60 bg-secondary/40 py-16">
      <div className="container-page grid items-center gap-10 grid-cols-1 lg:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-accent">
            {t("home.followJourneyEyebrow")}
          </p>
          <h2 className="mt-2 font-display text-3xl font-medium tracking-tight md:text-4xl">
            {t("home.followJourneyTitle")}
          </h2>
          <p className="mt-3 max-w-lg text-muted-foreground">{t("home.followJourneyDesc")}</p>
          <Button asChild className="mt-6">
            <Link to="/breeders">
              {t("home.followJourney.cta")} <ChevronRight className="ml-1 size-4" />
            </Link>
          </Button>
        </div>
        <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
              <Heart className="size-5" />
            </div>
            <div>
              <div className="font-medium">{t("home.followJourney.cardTitle")}</div>
              <div className="text-xs text-muted-foreground">
                {t("home.followJourney.cardSubtitle")}
              </div>
            </div>
          </div>
          <div className="my-3 h-px bg-border/60" />
          <ul className="space-y-3 text-sm">
            {[
              [t("home.followJourney.timeline1Title"), t("home.followJourney.timeline1Desc")],
              [t("home.followJourney.timeline2Title"), t("home.followJourney.timeline2Desc")],
              [t("home.followJourney.timeline3Title"), t("home.followJourney.timeline3Desc")],
            ].map(([title, desc]) => (
              <li key={title} className="flex items-start gap-2">
                <Sparkles className="mt-0.5 size-3.5 shrink-0 text-accent" />
                <div>
                  <div className="font-medium">{title}</div>
                  <div className="text-xs text-muted-foreground">{desc}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Pedigrees() {
  const { t } = useTranslation();
  return (
    <section className="container-page py-16">
      <div className="grid items-center gap-10 grid-cols-1 lg:grid-cols-2">
        <div className="order-2 flex justify-center lg:order-1">
          <div className="grid w-full max-w-sm gap-2 rounded-2xl border border-border/70 bg-card p-6">
            {[
              [t("home.pedigreeCards.sireDamLabel"), t("home.pedigreeCards.sireDamLevel")],
              [
                t("home.pedigreeCards.grandparentsLabel"),
                t("home.pedigreeCards.grandparentsLevel"),
              ],
              [t("home.pedigreeCards.registryLabel"), t("home.pedigreeCards.registryLevel")],
            ].map(([label, level]) => (
              <div key={label} className="rounded-xl border border-border/60 bg-secondary/40 p-3">
                <div className="text-sm font-medium">{label}</div>
                <div className="text-xs text-muted-foreground">{level}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="order-1 lg:order-2">
          <p className="text-xs font-medium uppercase tracking-wider text-accent">
            {t("home.pedigreesEyebrow")}
          </p>
          <h2 className="mt-2 font-display text-3xl font-medium tracking-tight md:text-4xl">
            {t("home.pedigreesTitle")}
          </h2>
          <p className="mt-3 max-w-lg text-muted-foreground">{t("home.pedigreesDesc")}</p>
          <div className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <GitBranch className="size-3.5" /> {t("home.pedigreeCards.footerNote")}
          </div>
        </div>
      </div>
    </section>
  );
}

function TransportSection() {
  const { t } = useTranslation();
  const features = [
    t("home.transportSection.feature1"),
    t("home.transportSection.feature2"),
    t("home.transportSection.feature3"),
    t("home.transportSection.feature4"),
    t("home.transportSection.feature5"),
  ];
  return (
    <section className="container-page py-16">
      <div className="overflow-hidden rounded-3xl border border-border/70 bg-card">
        <div className="grid grid-cols-1 lg:grid-cols-2">
          <div className="relative aspect-[4/3] lg:aspect-auto">
            <img
              src={transportImg}
              alt="Transport crate loaded into a van"
              loading="lazy"
              className="absolute inset-0 size-full object-cover"
            />
          </div>
          <div className="flex flex-col justify-center p-8 md:p-12">
            <p className="text-xs font-medium uppercase tracking-wider text-accent">
              {t("home.transportSection.eyebrow")}
            </p>
            <h2 className="mt-2 font-display text-3xl font-medium">
              {t("home.transportSection.title")}
            </h2>
            <p className="mt-3 text-muted-foreground">{t("home.transportSection.desc")}</p>

            <div className="mt-6 rounded-xl border border-border bg-background p-4">
              <div className="flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium">{t("home.transportSection.pickupCity")}</div>
                  <div className="text-xs text-muted-foreground">
                    {t("home.transportSection.pickupLabel")}
                  </div>
                </div>
                <div className="flex flex-1 items-center px-4">
                  <div className="h-px flex-1 border-t border-dashed border-border" />
                  <Truck className="mx-2 size-4 text-primary" />
                  <div className="h-px flex-1 border-t border-dashed border-border" />
                </div>
                <div className="text-right">
                  <div className="font-medium">{t("home.transportSection.handoverCity")}</div>
                  <div className="text-xs text-muted-foreground">
                    {t("home.transportSection.handoverLabel")}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">{t("home.transportSection.badgeShared")}</Badge>
                <Badge variant="secondary">{t("home.transportSection.badgeDocuments")}</Badge>
                <Badge variant="secondary">{t("home.transportSection.badgeReady")}</Badge>
              </div>
            </div>

            <ul className="mt-6 grid grid-cols-2 gap-3 text-sm">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-muted-foreground">
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                  {f}
                </li>
              ))}
            </ul>

            <div className="mt-8 flex gap-2">
              <Button asChild size="lg">
                <Link to="/transport/request">{t("home.requestTransport")}</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/transport">{t("home.transportSection.ctaCompare")}</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorksStrip() {
  const { t } = useTranslation();
  const steps = [
    [t("home.howItWorksStrip.step1Title"), t("home.howItWorksStrip.step1Desc")],
    [t("home.howItWorksStrip.step2Title"), t("home.howItWorksStrip.step2Desc")],
    [t("home.howItWorksStrip.step3Title"), t("home.howItWorksStrip.step3Desc")],
    [t("home.howItWorksStrip.step4Title"), t("home.howItWorksStrip.step4Desc")],
    [t("home.howItWorksStrip.step5Title"), t("home.howItWorksStrip.step5Desc")],
  ];
  return (
    <section className="border-y border-border/60 bg-secondary/40 py-16">
      <div className="container-page">
        <SectionHeader
          eyebrow={t("home.howItWorksStrip.eyebrow")}
          title={t("home.howItWorksStrip.title")}
          cta={{ label: t("home.howItWorksStrip.cta"), to: "/how-it-works" }}
        />
        <ol className="grid gap-4 grid-cols-1 md:grid-cols-5">
          {steps.map(([t, d], i) => (
            <li key={t} className="rounded-2xl border border-border/70 bg-card p-5">
              <div className="grid size-8 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {i + 1}
              </div>
              <h3 className="mt-3 font-display text-lg font-semibold">{t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function FinalCTA() {
  const { t } = useTranslation();
  return (
    <section className="container-page py-20">
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
        <div className="flex flex-col justify-between rounded-3xl border border-border/70 bg-primary p-10 text-primary-foreground">
          <div>
            <div className="grid size-12 place-items-center rounded-2xl bg-primary-foreground/15">
              <Truck className="size-6" />
            </div>
            <h3 className="mt-5 font-display text-3xl font-medium">
              {t("home.finalCTA.transportTitle")}
            </h3>
            <p className="mt-2 text-primary-foreground/80">{t("home.finalCTA.transportDesc")}</p>
          </div>
          <Button asChild size="lg" variant="secondary" className="mt-8 w-fit">
            <Link to="/transport/request">{t("home.requestTransport")}</Link>
          </Button>
        </div>
        <div className="flex flex-col justify-between rounded-3xl border border-border/70 bg-card p-10">
          <div>
            <div className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Users className="size-6" />
            </div>
            <h3 className="mt-5 font-display text-3xl font-medium">
              {t("home.finalCTA.breederTitle")}
            </h3>
            <p className="mt-2 text-muted-foreground">{t("home.finalCTA.breederDesc")}</p>
          </div>
          <Button asChild size="lg" variant="outline" className="mt-8 w-fit">
            <Link to="/create-breeder" search={{ type: "kennel" }}>
              {t("home.finalCTA.breederCta")}
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
