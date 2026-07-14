import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { buyerApplications, puppies, savedPuppies } from "@/lib/mock-data";
import { Heart, MessageSquare, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/dashboard/buyer/")({
  component: BuyerOverview,
});

function BuyerOverview() {
  const saved = puppies.filter((p) => savedPuppies.includes(p.id));
  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">Welcome back, Julia</h1>
        <p className="text-sm text-muted-foreground">Here's where your journey stands today.</p>
      </header>

      <div className="rounded-2xl border border-success/30 bg-success/10 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <Badge className="bg-success/20 text-success">Update</Badge>
          <p className="text-sm">
            <strong>Application approved</strong> — breeder is waiting for your reservation decision for <strong>Bella</strong>.
          </p>
          <Button size="sm" className="ml-auto">Continue to reservation</Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Card title="Applications" icon={<MessageSquare className="size-5" />}>
          <div className="font-display text-3xl font-semibold">3</div>
          <div className="text-sm text-muted-foreground">1 approved, 1 in review, 1 waiting list</div>
        </Card>
        <Card title="Saved puppies" icon={<Heart className="size-5" />}>
          <div className="font-display text-3xl font-semibold">{saved.length}</div>
          <div className="text-sm text-muted-foreground">All from verified breeders</div>
        </Card>
        <Card title="Reservations" icon={<ArrowRight className="size-5" />}>
          <div className="font-display text-3xl font-semibold">1</div>
          <div className="text-sm text-muted-foreground">Deposit awaiting</div>
        </Card>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-xl font-semibold">Your applications</h2>
        <ul className="space-y-2">
          {buyerApplications.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card p-4">
              <div>
                <div className="font-medium">{a.puppyName} — {a.kennel}</div>
                <div className="text-xs text-muted-foreground">Applied {new Date(a.date).toLocaleDateString("en-GB")}</div>
                <div className="mt-1 text-sm text-muted-foreground">{a.note}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{a.status}</Badge>
                <Button asChild size="sm" variant="outline"><Link to="/puppies/$id" params={{ id: a.puppyId }}>Open puppy</Link></Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-xl font-semibold">Saved puppies</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {saved.map((p) => (
            <Link key={p.id} to="/puppies/$id" params={{ id: p.id }} className="group overflow-hidden rounded-2xl border border-border/70 bg-card transition-colors hover:bg-secondary/40">
              <img src={p.image} alt="" className="aspect-[4/3] w-full object-cover" />
              <div className="p-4">
                <div className="font-display text-lg font-semibold">{p.name}</div>
                <div className="text-sm text-muted-foreground">{p.breed} · {p.kennel}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5">
      <div className="flex items-center gap-2 text-primary">
        <span className="grid size-9 place-items-center rounded-xl bg-primary/10">{icon}</span>
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}
