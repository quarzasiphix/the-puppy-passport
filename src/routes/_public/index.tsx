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
import hero from "@/assets/hero-breeder.jpg";
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
  // Animal discovery and the marketplace come first — Havenpaw is a dedicated animal ecosystem,
  // not a transport company with a marketplace bolted on (see docs/PRODUCT_VISION.md). Transport
  // is a major advantage of the platform, not its primary identity, so its sections appear after
  // the animal-discovery content, not before it.
  return (
    <div>
      <Hero />
      <ActionLauncher variant="homepage" />
      <Trust />
      <FeaturedPuppies />
      <UpcomingLitters />
      <VerifiedBreeders />
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
      <div className="container-page grid gap-10 py-14 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:py-20">
        <div className="flex flex-col justify-center">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            <HeartHandshake className="size-3.5" /> {t("home.heroEyebrow")}
          </span>
          <h1 className="mt-4 font-display text-5xl font-medium leading-[1.05] tracking-tight text-foreground md:text-6xl">
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
            <Stat label="Verified breeders & foundations" value={String(verifiedOrgs)} />
            <Stat label="Available puppies" value={String(availableAnimals)} />
            <Stat label="Planned litters" value={String(plannedCount)} />
          </dl>
        </div>

        <div className="relative">
          <div className="absolute -left-6 -top-6 hidden size-64 rounded-full bg-accent/10 blur-3xl lg:block" />
          <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-card shadow-xl">
            <img
              src={hero}
              alt="Breeder handing over a puppy for transport"
              width={1600}
              height={1200}
              className="aspect-[4/5] size-full object-cover"
            />
          </div>
          <div className="absolute -bottom-6 -left-6 hidden max-w-xs rounded-2xl border border-border/70 bg-card p-4 shadow-lg md:block">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <Truck className="size-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">Warsaw → Amsterdam</p>
                <p className="text-xs text-muted-foreground">Shared route · ready for scheduling</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Documents reviewed · vehicle and driver assigned
            </p>
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

function ServiceCategories() {
  const categories = [
    {
      icon: Package,
      title: "Shared",
      desc: "Flexible dates, lower price, planned European routes.",
    },
    { icon: Truck, title: "Individual", desc: "Dedicated planning, direct pickup and handover." },
    {
      icon: Zap,
      title: "Express",
      desc: "Priority quotation and the earliest available departure.",
    },
    {
      icon: Crown,
      title: "VIP",
      desc: "Dedicated scheduling, premium communication, extra updates.",
    },
  ];
  return (
    <section className="container-page py-16">
      <SectionHeader
        eyebrow="Transport services"
        title="Four transport categories, one professional standard"
        desc="Every category meets the same legal and animal-welfare requirements — the difference is scheduling, privacy and communication, not the minimum standard of care."
        cta={{ label: "Compare transport options", to: "/transport" }}
      />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
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
  const items = [
    {
      icon: ShieldCheck,
      label: "Verified breeders & foundations",
      desc: "Identity, association & registration checked.",
    },
    {
      icon: FileCheck2,
      label: "Document review",
      desc: "Passport, microchip and health documents checked before scheduling.",
    },
    {
      icon: Stethoscope,
      label: "Health information visible",
      desc: "Health tests and veterinary status on file.",
    },
    {
      icon: HeartHandshake,
      label: "Structured applications",
      desc: "Fair, transparent buyer and adoption flow.",
    },
    {
      icon: Truck,
      label: "Operational transport",
      desc: "Planned routes, assigned vehicles and drivers, tracked status.",
    },
  ];
  return (
    <section className="border-y border-border/60 bg-background">
      <div className="container-page grid gap-6 py-10 md:grid-cols-5">
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
  if (featuredPuppies.length === 0) return null;
  return (
    <section className="container-page py-16">
      <SectionHeader
        eyebrow="Marketplace"
        title="Puppies ready to meet their family"
        desc="Currently available or open for applications from verified breeders."
        cta={{ label: "See all puppies", to: "/find-a-dog" }}
      />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {featuredPuppies.map((p) => (
          <PuppyCard key={p.id} p={p} />
        ))}
      </div>
    </section>
  );
}

function UpcomingLitters() {
  const { upcomingLitters } = Route.useLoaderData();
  if (upcomingLitters.length === 0) return null;
  return (
    <section className="border-y border-border/60 bg-secondary/40 py-16">
      <div className="container-page">
        <SectionHeader
          eyebrow="Upcoming litters"
          title="Planned litters"
          desc="Reserve your place on the waiting list — breeders confirm homes before puppies are born."
          cta={{ label: "All planned litters", to: "/planned-litters" }}
        />
        <div className="grid gap-6 lg:grid-cols-3">
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
  if (verifiedBreeders.length === 0) return null;
  return (
    <section className="container-page py-16">
      <SectionHeader
        eyebrow="Verified breeders"
        title="Kennels we've vetted personally"
        cta={{ label: "Browse breeders", to: "/breeders" }}
      />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {verifiedBreeders.map((b) => (
          <BreederCard key={b.id} b={b} />
        ))}
      </div>
    </section>
  );
}

function TransportSection() {
  return (
    <section className="container-page py-16">
      <div className="overflow-hidden rounded-3xl border border-border/70 bg-card">
        <div className="grid lg:grid-cols-2">
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
              How transport works
            </p>
            <h2 className="mt-2 font-display text-3xl font-medium">
              From request to handover, fully tracked
            </h2>
            <p className="mt-3 text-muted-foreground">
              Submit a transport request, we review the animal and document information, prepare a
              quotation, and — once accepted — plan pickup, route and handover. Final eligibility
              and pricing are confirmed after review, not guaranteed up front.
            </p>

            <div className="mt-6 rounded-xl border border-border bg-background p-4">
              <div className="flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium">Warsaw, Poland</div>
                  <div className="text-xs text-muted-foreground">Pickup</div>
                </div>
                <div className="flex flex-1 items-center px-4">
                  <div className="h-px flex-1 border-t border-dashed border-border" />
                  <Truck className="mx-2 size-4 text-primary" />
                  <div className="h-px flex-1 border-t border-dashed border-border" />
                </div>
                <div className="text-right">
                  <div className="font-medium">Amsterdam, Netherlands</div>
                  <div className="text-xs text-muted-foreground">Handover</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">Shared route</Badge>
                <Badge variant="secondary">Documents reviewed</Badge>
                <Badge variant="secondary">Ready for scheduling</Badge>
              </div>
            </div>

            <ul className="mt-6 grid grid-cols-2 gap-3 text-sm">
              {[
                "Document review",
                "Compliance check",
                "Route & vehicle assignment",
                "Status updates",
                "Shared or individual",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2 text-muted-foreground">
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                  {f}
                </li>
              ))}
            </ul>

            <div className="mt-8 flex gap-2">
              <Button asChild size="lg">
                <Link to="/transport/request">Request transport</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/transport">Compare service categories</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorksStrip() {
  const steps = [
    [
      "Submit a transport or dog request",
      "Tell us what you need — transport, a puppy, or an adoption.",
    ],
    ["We review the information", "Documents, animal fitness and compliance are checked."],
    ["Get a quotation", "Final service type and price are confirmed after review."],
    ["Schedule pickup", "Route, vehicle and driver are assigned."],
    ["Track to handover", "Status updates through collection, transit and delivery."],
  ];
  return (
    <section className="border-y border-border/60 bg-secondary/40 py-16">
      <div className="container-page">
        <SectionHeader
          eyebrow="How it works"
          title="A calm, professional process"
          cta={{ label: "Learn more", to: "/how-it-works" }}
        />
        <ol className="grid gap-4 md:grid-cols-5">
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
  return (
    <section className="container-page py-20">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col justify-between rounded-3xl border border-border/70 bg-primary p-10 text-primary-foreground">
          <div>
            <div className="grid size-12 place-items-center rounded-2xl bg-primary-foreground/15">
              <Truck className="size-6" />
            </div>
            <h3 className="mt-5 font-display text-3xl font-medium">Need to transport a dog?</h3>
            <p className="mt-2 text-primary-foreground/80">
              Submit a transport request — we review the details and confirm the best shared,
              individual, express or VIP option.
            </p>
          </div>
          <Button asChild size="lg" variant="secondary" className="mt-8 w-fit">
            <Link to="/transport/request">Request transport</Link>
          </Button>
        </div>
        <div className="flex flex-col justify-between rounded-3xl border border-border/70 bg-card p-10">
          <div>
            <div className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Users className="size-6" />
            </div>
            <h3 className="mt-5 font-display text-3xl font-medium">Breeder or foundation?</h3>
            <p className="mt-2 text-muted-foreground">
              Publish your litters or adoption listings once verified, and connect directly with our
              transport network.
            </p>
          </div>
          <Button asChild size="lg" variant="outline" className="mt-8 w-fit">
            <Link to="/create-breeder">Apply for verification</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
