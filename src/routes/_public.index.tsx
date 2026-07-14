import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, MapPin, Calendar, ArrowRight, ShieldCheck, HeartHandshake, FileCheck2, Stethoscope, Truck, PawPrint, ChevronRight, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { puppies, breeders, plannedLitters } from "@/lib/mock-data";
import { PuppyCard, LitterCard, BreederCard } from "@/components/cards";
import hero from "@/assets/hero-breeder.jpg";
import transportImg from "@/assets/transport.jpg";

export const Route = createFileRoute("/_public/")({
  component: Home,
});

function Home() {
  return (
    <div>
      <Hero />
      <Trust />
      <FeaturedPuppies />
      <UpcomingLitters />
      <VerifiedBreeders />
      <TransportSection />
      <HowItWorksStrip />
      <FinalCTA />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border/60 bg-secondary/40">
      <div className="container-page grid gap-10 py-14 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:py-20">
        <div className="flex flex-col justify-center">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            <PawPrint className="size-3.5" /> A specialist puppy marketplace
          </span>
          <h1 className="mt-4 font-display text-5xl font-medium leading-[1.05] tracking-tight text-foreground md:text-6xl">
            Find a dog from a <span className="italic text-primary">verified breeder</span>.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            Discover litters from vetted European breeders, apply directly, complete the
            reservation process, and arrange safe transport — all in one place.
          </p>

          <div className="mt-8 rounded-2xl border border-border/70 bg-card p-3 shadow-sm">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-[1.1fr_1fr_1fr_auto]">
              <Field icon={<Search className="size-4" />} placeholder="Breed (e.g. Border Collie)" />
              <Field icon={<MapPin className="size-4" />} placeholder="Location" />
              <Field icon={<Calendar className="size-4" />} placeholder="Ready by" />
              <Button asChild size="lg" className="h-12 gap-1">
                <Link to="/find-a-dog">
                  Search <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {[
              ["Available now", "/find-a-dog"],
              ["Planned litters", "/planned-litters"],
              ["Transport available", "/transport"],
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
            <Stat label="Verified breeders" value="240+" />
            <Stat label="Successful handovers" value="3,800" />
            <Stat label="Countries covered" value="18" />
          </dl>
        </div>

        <div className="relative">
          <div className="absolute -left-6 -top-6 hidden size-64 rounded-full bg-accent/10 blur-3xl lg:block" />
          <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-card shadow-xl">
            <img
              src={hero}
              alt="Breeder with a litter of puppies"
              width={1600}
              height={1200}
              className="aspect-[4/5] size-full object-cover"
            />
          </div>
          <div className="absolute -bottom-6 -left-6 hidden max-w-xs rounded-2xl border border-border/70 bg-card p-4 shadow-lg md:block">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">Cichy Las Kennel</p>
                <p className="text-xs text-muted-foreground">Verified · Warsaw, Poland</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              14 yrs experience · ZKwP / FCI · 4 puppies available
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({ icon, placeholder }: { icon: React.ReactNode; placeholder: string }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
        {icon}
      </span>
      <Input placeholder={placeholder} className="h-12 border-transparent bg-secondary/60 pl-9" />
    </div>
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

function Trust() {
  const items = [
    { icon: ShieldCheck, label: "Verified breeders", desc: "Identity, kennel & association checked." },
    { icon: FileCheck2, label: "Confirmed litter info", desc: "Parents, birth date and pedigree." },
    { icon: Stethoscope, label: "Health tests visible", desc: "HD, ED, DNA & eye tests on file." },
    { icon: HeartHandshake, label: "Structured applications", desc: "Fair, transparent buyer flow." },
    { icon: Truck, label: "Safe transport", desc: "Planned routes with rest stops." },
  ];
  return (
    <section className="border-b border-border/60 bg-background">
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
            {cta.label} <ArrowRight className="ml-1 size-4" />
          </Link>
        </Button>
      )}
    </div>
  );
}

function FeaturedPuppies() {
  return (
    <section className="container-page py-16">
      <SectionHeader
        eyebrow="Featured puppies"
        title="Puppies ready to meet their family"
        desc="Handpicked, currently available or open for applications from verified breeders."
        cta={{ label: "See all puppies", to: "/find-a-dog" }}
      />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {puppies.slice(0, 6).map((p) => (
          <PuppyCard key={p.id} p={p} />
        ))}
      </div>
    </section>
  );
}

function UpcomingLitters() {
  return (
    <section className="border-y border-border/60 bg-secondary/40 py-16">
      <div className="container-page">
        <SectionHeader
          eyebrow="Upcoming litters"
          title="Planned litters for autumn and winter"
          desc="Reserve your place on the waiting list — breeders confirm homes before puppies are born."
          cta={{ label: "All planned litters", to: "/planned-litters" }}
        />
        <div className="grid gap-6 lg:grid-cols-3">
          {plannedLitters.map((l) => (
            <LitterCard key={l.id} l={l} planned />
          ))}
        </div>
      </div>
    </section>
  );
}

function VerifiedBreeders() {
  return (
    <section className="container-page py-16">
      <SectionHeader
        eyebrow="Verified breeders"
        title="Kennels we've vetted personally"
        cta={{ label: "Browse breeders", to: "/breeders" }}
      />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {breeders.map((b) => (
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
            <img src={transportImg} alt="Transport" loading="lazy" className="absolute inset-0 size-full object-cover" />
          </div>
          <div className="flex flex-col justify-center p-8 md:p-12">
            <p className="text-xs font-medium uppercase tracking-wider text-accent">Transport</p>
            <h2 className="mt-2 font-display text-3xl font-medium">
              Safe, planned transport across Europe
            </h2>
            <p className="mt-3 text-muted-foreground">
              Whether you're travelling from Warsaw to Berlin or Kraków to Amsterdam, we
              coordinate pickup, rest stops and delivery — with all documents in order.
            </p>

            <div className="mt-6 rounded-xl border border-border bg-background p-4">
              <div className="flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium">Warsaw, Poland</div>
                  <div className="text-xs text-muted-foreground">Cichy Las Kennel</div>
                </div>
                <div className="flex flex-1 items-center px-4">
                  <div className="h-px flex-1 border-t border-dashed border-border" />
                  <Truck className="mx-2 size-4 text-primary" />
                  <div className="h-px flex-1 border-t border-dashed border-border" />
                </div>
                <div className="text-right">
                  <div className="font-medium">Berlin, Germany</div>
                  <div className="text-xs text-muted-foreground">Home delivery</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">Shared van</Badge>
                <Badge variant="secondary">~ 7 hrs total</Badge>
                <Badge variant="secondary">€320 per puppy</Badge>
              </div>
            </div>

            <ul className="mt-6 grid grid-cols-2 gap-3 text-sm">
              {["Pickup from breeder", "Planned rest stops", "Document checklist", "Delivery status updates", "Shared or individual"].map((f) => (
                <li key={f} className="flex items-start gap-2 text-muted-foreground">
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                  {f}
                </li>
              ))}
            </ul>

            <div className="mt-8 flex gap-2">
              <Button asChild size="lg">
                <Link to="/transport">Check transport options</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/transport/request">Request a quote</Link>
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
    ["Find a breeder or litter", "Search by breed, region and readiness."],
    ["Submit an application", "Answer questions about your home and plans."],
    ["Get approved by the breeder", "The breeder confirms fit and next steps."],
    ["Reserve the puppy", "Deposit and agreement to secure your puppy."],
    ["Collect or arrange transport", "Meet in person, or arrange safe transport."],
  ];
  return (
    <section className="border-y border-border/60 bg-secondary/40 py-16">
      <div className="container-page">
        <SectionHeader eyebrow="How it works" title="A calm, five-step process" cta={{ label: "Learn more", to: "/how-it-works" }} />
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
        <div className="flex flex-col justify-between rounded-3xl border border-border/70 bg-card p-10">
          <div>
            <div className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Users className="size-6" />
            </div>
            <h3 className="mt-5 font-display text-3xl font-medium">I am looking for a dog</h3>
            <p className="mt-2 text-muted-foreground">
              Browse verified breeders, apply for a puppy that fits your home, and get help
              with reservations and transport.
            </p>
          </div>
          <Button asChild size="lg" className="mt-8 w-fit">
            <Link to="/find-a-dog">Find your dog</Link>
          </Button>
        </div>
        <div className="flex flex-col justify-between rounded-3xl border border-border/70 bg-primary p-10 text-primary-foreground">
          <div>
            <div className="grid size-12 place-items-center rounded-2xl bg-primary-foreground/15">
              <PawPrint className="size-6" />
            </div>
            <h3 className="mt-5 font-display text-3xl font-medium">I am a breeder</h3>
            <p className="mt-2 text-primary-foreground/80">
              Publish your litters, review applications in one place, and reach responsible
              families across Europe.
            </p>
          </div>
          <Button asChild size="lg" variant="secondary" className="mt-8 w-fit">
            <Link to="/create-breeder">Create breeder profile</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
