import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/shared/ui/button";
import { ShieldCheck, FileCheck2, Stethoscope, HeartHandshake, Truck } from "lucide-react";

export const Route = createFileRoute("/_public/how-it-works")({
  head: () => ({ meta: [{ title: "How it works — Havenpaw" }] }),
  component: HowItWorks,
});

const steps = [
  [
    "Find a breeder or litter",
    "Search verified kennels and current or planned litters. Save what interests you.",
  ],
  ["Submit an application", "A structured form helps the breeder understand your home and plans."],
  [
    "Get approved by the breeder",
    "The breeder reviews, asks questions or invites you to a video call.",
  ],
  ["Reserve the puppy", "Pay a deposit and sign the sales agreement — everything is tracked here."],
  [
    "Collect the puppy or arrange transport",
    "Meet in person, or book safe transport across Europe.",
  ],
];

const trust = [
  {
    icon: ShieldCheck,
    label: "Verified breeders",
    desc: "Identity, kennel and association membership checked.",
  },
  {
    icon: FileCheck2,
    label: "Confirmed litters",
    desc: "Parents, birth date and pedigree confirmed before publishing.",
  },
  {
    icon: Stethoscope,
    label: "Health testing visible",
    desc: "HD, ED, eye tests and DNA panels shown on parent profiles.",
  },
  {
    icon: HeartHandshake,
    label: "Structured applications",
    desc: "A calm, transparent process for both sides.",
  },
  {
    icon: Truck,
    label: "Safe transport",
    desc: "Planned routes with rest stops and delivery updates.",
  },
];

function HowItWorks() {
  return (
    <div>
      <section className="border-b border-border/60 bg-secondary/40 py-16">
        <div className="container-page max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-wider text-accent">How it works</p>
          <h1 className="mt-2 font-display text-5xl font-medium">
            A calm, transparent way to find a puppy
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Havenpaw is a specialist marketplace for responsibly bred puppies — not a classified ads
            site. Every kennel is verified, every litter is confirmed, and every application flows
            through a structured process.
          </p>
        </div>
      </section>

      <section className="container-page py-16">
        <h2 className="mb-8 font-display text-3xl font-medium">Five steps from start to finish</h2>
        <ol className="grid gap-4 md:grid-cols-5">
          {steps.map(([t, d], i) => (
            <li key={t} className="rounded-2xl border border-border/70 bg-card p-6">
              <div className="grid size-9 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {i + 1}
              </div>
              <h3 className="mt-3 font-display text-lg font-semibold">{t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-border/60 bg-secondary/40 py-16">
        <div className="container-page">
          <h2 className="mb-8 font-display text-3xl font-medium">What we verify</h2>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
            {trust.map((t) => (
              <div key={t.label} className="rounded-2xl border border-border/70 bg-card p-6">
                <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <t.icon className="size-5" />
                </div>
                <h3 className="mt-4 font-display text-lg font-semibold">{t.label}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page py-16">
        <div className="rounded-3xl border border-border/70 bg-card p-8 md:p-12">
          <h2 className="font-display text-3xl font-medium">Reviews only after handover</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            To keep reviews honest, buyers can only leave a review after a confirmed reservation and
            handover. Reviews cover communication, accuracy of information, puppy condition at
            handover, documents and overall experience. Transport has its own separate review.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/find-a-dog">Find your dog</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/create-breeder">I'm a breeder</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
