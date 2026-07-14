import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Truck, Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { transportSteps } from "@/lib/mock-data";

export const Route = createFileRoute("/_public/transport/request")({
  head: () => ({ meta: [{ title: "Request transport — Havenpaw" }] }),
  component: TransportRequestPage,
});

function TransportRequestPage() {
  const [submitted, setSubmitted] = useState(false);
  return (
    <div className="container-page py-10">
      <header className="mb-8">
        <p className="text-xs font-medium uppercase tracking-wider text-accent">Transport request</p>
        <h1 className="mt-1 font-display text-4xl font-medium">Plan a safe journey for your puppy</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Tell us the basics — we prepare a quote and coordinate with the breeder.
        </p>
      </header>

      {!submitted ? (
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitted(true);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="space-y-8"
          >
            <Section title="Puppy & breeder">
              <div className="grid gap-4 md:grid-cols-2">
                <F label="Puppy"><Input defaultValue="Bruno — German Shepherd" /></F>
                <F label="Breeder / kennel"><Input defaultValue="Dolne Pola" /></F>
                <F label="Pickup location"><Input defaultValue="Poznań, Poland" /></F>
                <F label="Delivery destination"><Input defaultValue="Munich, Germany" /></F>
              </div>
            </Section>

            <Section title="Dates">
              <div className="grid gap-4 md:grid-cols-2">
                <F label="Preferred date"><Input type="date" /></F>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm"><Checkbox /> I'm flexible on the date</label>
                </div>
              </div>
            </Section>

            <Section title="Transport type">
              <RadioGroup defaultValue="shared" className="grid gap-2 md:grid-cols-2">
                <Radio value="shared" title="Shared transport" desc="Multiple puppies routed together — most economical." />
                <Radio value="individual" title="Individual transport" desc="Dedicated vehicle — direct and faster." />
              </RadioGroup>
              <RadioGroup defaultValue="home" className="mt-4 grid gap-2 md:grid-cols-2">
                <Radio value="home" title="Home delivery" desc="We deliver to your door." />
                <Radio value="meet" title="Meeting point" desc="Pick up at an agreed location on the route." />
              </RadioGroup>
            </Section>

            <Section title="Contact">
              <div className="grid gap-4 md:grid-cols-2">
                <F label="Full name"><Input /></F>
                <F label="Phone"><Input /></F>
                <F label="Email"><Input type="email" /></F>
                <F label="City"><Input /></F>
              </div>
              <F label="Notes"><Textarea rows={4} placeholder="Special requirements, arrival window, other puppies…" /></F>
            </Section>

            <Button type="submit" size="lg"><Truck className="mr-2 size-4" /> Submit request</Button>
          </form>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-border/70 bg-card p-6">
              <h3 className="font-display text-lg font-semibold">Estimated quotation</h3>
              <div className="mt-4 space-y-2 text-sm">
                <Row label="Base transport" value="€260" />
                <Row label="Border documentation" value="€30" />
                <Row label="Insurance" value="€30" />
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
                <span className="text-sm font-medium">Total (approx.)</span>
                <span className="font-display text-xl font-semibold">€320</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5 text-xs">
                <Badge variant="secondary">Shared van</Badge>
                <Badge variant="secondary">Next route 26 Jul</Badge>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Final quote is confirmed with the breeder before scheduling.
              </p>
            </div>
          </aside>
        </div>
      ) : (
        <div className="rounded-3xl border border-border/70 bg-card p-8">
          <div className="mx-auto grid size-14 place-items-center rounded-full bg-success/15 text-success">
            <Check className="size-7" />
          </div>
          <h2 className="mt-4 text-center font-display text-2xl font-medium">
            Transport request submitted
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-center text-sm text-muted-foreground">
            We're preparing your quote — you'll receive updates as things progress.
          </p>
          <ol className="mt-8 grid gap-2 md:grid-cols-4 lg:grid-cols-8">
            {transportSteps.map((s, i) => (
              <li key={s} className={`rounded-xl border p-3 text-xs ${i === 0 ? "border-primary bg-primary/5 text-primary" : "border-border/70 bg-background text-muted-foreground"}`}>
                <div className="flex items-center gap-1">
                  {i === 0 && <Check className="size-3" />}
                  <span className="font-medium">Step {i + 1}</span>
                </div>
                <div className="mt-1">{s}</div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-6">
      <h3 className="mb-4 font-display text-lg font-semibold">{title}</h3>
      {children}
    </section>
  );
}
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
function Radio({ value, title, desc }: { value: string; title: string; desc: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background p-4 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
      <RadioGroupItem value={value} className="mt-0.5" />
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </label>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
