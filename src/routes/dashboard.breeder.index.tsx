import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Dog, Inbox, CalendarCheck, Truck, Eye, Heart, ArrowUpRight } from "lucide-react";
import { applications, puppies, reservations, transportRequests } from "@/lib/mock-data";

export const Route = createFileRoute("/dashboard/breeder/")({
  component: BreederOverview,
});

function BreederOverview() {
  const openApps = applications.filter((a) => a.status !== "approved").length;
  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">Welcome back, Anna</h1>
        <p className="text-sm text-muted-foreground">Here's what's happening in your kennel today.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Dog} label="Active puppies" value={puppies.filter((p) => p.status !== "sold").length} trend="+2 this week" />
        <Kpi icon={Inbox} label="Open applications" value={openApps} trend="3 new" />
        <Kpi icon={CalendarCheck} label="Pending reservations" value={reservations.length} trend="1 awaits deposit" />
        <Kpi icon={Truck} label="Transport requests" value={transportRequests.length} trend="1 in transit" />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <MiniStat icon={Eye} label="Profile views (30d)" value="1,284" />
        <MiniStat icon={Heart} label="Saved by buyers" value="316" />
        <MiniStat icon={CalendarCheck} label="Upcoming collections" value="2" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card title="Recent applications" cta="View all">
          <ul className="divide-y divide-border/60">
            {applications.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <div className="font-medium">{a.buyer} <span className="text-xs text-muted-foreground">for {a.puppy}</span></div>
                  <div className="text-xs text-muted-foreground">{a.city}, {a.country} · {a.household}</div>
                </div>
                <StatusPill status={a.status} />
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Activity">
          <ol className="relative space-y-4 border-l border-border/60 pl-4">
            {[
              ["Application approved", "Ewa Malinowska · Bruno", "2h ago"],
              ["Deposit received", "Piotr Lewandowski · Coco", "5h ago"],
              ["Puppy status updated", "Maja → Available", "Yesterday"],
              ["Transport scheduled", "Bruno · Poznań → Munich", "Yesterday"],
              ["New application", "Lars Andersen · Rico", "2 days ago"],
            ].map(([t, d, w]) => (
              <li key={t as string} className="relative">
                <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-primary" />
                <div className="text-sm font-medium">{t}</div>
                <div className="text-xs text-muted-foreground">{d}</div>
                <div className="text-xs text-muted-foreground">{w}</div>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, trend }: { icon: any; label: string; value: number | string; trend: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <ArrowUpRight className="size-4 text-muted-foreground" />
      </div>
      <div className="mt-4 font-display text-3xl font-semibold">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-xs text-success">{trend}</div>
    </div>
  );
}
function MiniStat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-4">
      <div className="grid size-10 place-items-center rounded-xl bg-secondary text-foreground">
        <Icon className="size-5" />
      </div>
      <div>
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="font-display text-xl font-semibold">{value}</div>
      </div>
    </div>
  );
}
export function Card({ title, cta, children }: { title: string; cta?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">{title}</h3>
        {cta && <button className="text-xs text-primary hover:underline">{cta}</button>}
      </div>
      {children}
    </section>
  );
}
export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    new: "bg-accent/15 text-accent",
    "in-review": "bg-warning/20 text-foreground",
    approved: "bg-success/15 text-success",
    "waiting-list": "bg-muted text-muted-foreground",
    rejected: "bg-destructive/10 text-destructive",
  };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${map[status] ?? "bg-muted text-muted-foreground"}`}>{status.replace("-", " ")}</span>;
}
