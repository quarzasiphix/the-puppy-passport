import { createFileRoute, Link } from "@tanstack/react-router";
import { Truck, MapPin, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { transportSteps, transportRequests } from "@/lib/mock-data";
import transportImg from "@/assets/transport.jpg";

export const Route = createFileRoute("/_public/transport")({
  head: () => ({ meta: [{ title: "Transport — Havenpaw" }] }),
  component: TransportPage,
});

function TransportPage() {
  return (
    <div>
      <section className="border-b border-border/60 bg-secondary/40">
        <div className="container-page grid gap-10 py-14 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-accent">Transport</p>
            <h1 className="mt-2 font-display text-5xl font-medium">
              Safe transport for your puppy across Europe
            </h1>
            <p className="mt-3 max-w-xl text-muted-foreground">
              Shared and individual routes coordinated with the breeder — with rest stops, health
              paperwork and delivery updates.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button asChild size="lg"><Link to="/transport/request">Request transport</Link></Button>
              <Button size="lg" variant="outline">See sample route</Button>
            </div>
          </div>
          <div className="overflow-hidden rounded-3xl border border-border/70">
            <img src={transportImg} alt="" className="aspect-[4/3] size-full object-cover" />
          </div>
        </div>
      </section>

      <section className="container-page py-14">
        <h2 className="mb-6 font-display text-2xl font-medium">Example routes</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["Warsaw, PL", "Berlin, DE", "€320", "Shared van"],
            ["Kraków, PL", "Amsterdam, NL", "€480", "Shared van"],
            ["Wrocław, PL", "Vienna, AT", "€380", "Shared van"],
          ].map(([from, to, price, type]) => (
            <div key={from} className="rounded-2xl border border-border/70 bg-card p-5">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="size-4 text-primary" /> {from}
                <ArrowRight className="mx-1 size-4 text-muted-foreground" />
                {to}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <Badge variant="secondary">{type}</Badge>
                <div className="font-display text-lg font-semibold">{price}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="container-page py-14">
        <h2 className="mb-6 font-display text-2xl font-medium">How your puppy travels</h2>
        <ol className="grid gap-3 md:grid-cols-4 lg:grid-cols-8">
          {transportSteps.map((s, i) => (
            <li key={s} className="rounded-xl border border-border/70 bg-card p-4">
              <div className="grid size-7 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {i + 1}
              </div>
              <div className="mt-2 text-sm font-medium">{s}</div>
            </li>
          ))}
        </ol>
      </section>

      <section className="container-page py-14">
        <h2 className="mb-6 font-display text-2xl font-medium">Sample active transports</h2>
        <div className="space-y-3">
          {transportRequests.map((t) => (
            <div key={t.id} className="rounded-2xl border border-border/70 bg-card p-5">
              <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="font-medium">{t.puppy}</span>
                    <span className="text-muted-foreground">{t.from} <ArrowRight className="mx-1 inline size-3" /> {t.to}</span>
                    <Badge variant="secondary">{t.type}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {transportSteps.map((s, i) => (
                      <span
                        key={s}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${i <= t.step ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                      >
                        {i <= t.step && <Check className="size-3" />} {s}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-display text-lg font-semibold">€{t.priceEUR}</div>
                  <div className="text-xs text-muted-foreground">{t.status}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="container-page pb-16">
        <div className="rounded-3xl border border-border/70 bg-primary p-10 text-primary-foreground">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <h3 className="font-display text-3xl font-medium">Ready to bring your puppy home?</h3>
              <p className="mt-1 text-primary-foreground/80">Request a quote — takes 2 minutes.</p>
            </div>
            <Button asChild size="lg" variant="secondary">
              <Link to="/transport/request"><Truck className="mr-1 size-4" /> Request transport</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
