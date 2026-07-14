import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PawPrint, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_public/create-breeder")({
  head: () => ({ meta: [{ title: "Create breeder profile — Havenpaw" }] }),
  component: CreateBreeder,
});

function CreateBreeder() {
  return (
    <div className="container-page py-14">
      <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-accent">For breeders</p>
          <h1 className="mt-1 font-display text-4xl font-medium">Create your kennel profile</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Publish your litters, receive structured applications and reach responsible families
            across Europe. Verification takes 2–5 working days.
          </p>

          <form className="mt-8 space-y-6">
            <Section title="Kennel">
              <div className="grid gap-4 md:grid-cols-2">
                <F label="Kennel name"><Input placeholder="Cichy Las Kennel" /></F>
                <F label="Owner name"><Input placeholder="Anna Kowalska" /></F>
                <F label="City"><Input placeholder="Warsaw" /></F>
                <F label="Country"><Input placeholder="Poland" /></F>
              </div>
            </Section>

            <Section title="Breeds & association">
              <div className="grid gap-4 md:grid-cols-2">
                <F label="Breeds you raise"><Input placeholder="Golden Retriever, Labrador…" /></F>
                <F label="Kennel club / association"><Input placeholder="ZKwP / FCI" /></F>
                <F label="Years of experience"><Input type="number" placeholder="14" /></F>
                <F label="Registration number"><Input placeholder="e.g. FCI/PL/…" /></F>
              </div>
            </Section>

            <Section title="About the kennel">
              <F label="Short description">
                <Textarea rows={5} placeholder="Share your breeding philosophy, how puppies are raised, and how you support families after handover." />
              </F>
            </Section>

            <Section title="Contact">
              <div className="grid gap-4 md:grid-cols-2">
                <F label="Email"><Input type="email" /></F>
                <F label="Phone"><Input /></F>
              </div>
            </Section>

            <div className="flex flex-wrap gap-2">
              <Button size="lg">Submit for verification</Button>
              <Button size="lg" variant="outline">Save draft</Button>
            </div>
          </form>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-border/70 bg-card p-6">
            <div className="flex items-center gap-2 text-primary">
              <ShieldCheck className="size-5" />
              <span className="text-sm font-semibold">What verification checks</span>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>· Owner identity</li>
              <li>· Kennel registration</li>
              <li>· Association membership</li>
              <li>· Reference from vet or association</li>
              <li>· Sample health records</li>
            </ul>
            <div className="mt-6 rounded-xl border border-border/70 bg-secondary/50 p-4">
              <div className="flex items-center gap-2">
                <PawPrint className="size-4 text-primary" />
                <span className="text-sm font-semibold">Free to publish</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                We take a small fee only when a reservation goes through. No listing fees, no ads.
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
