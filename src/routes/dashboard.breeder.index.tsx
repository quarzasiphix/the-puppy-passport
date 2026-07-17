import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Dog, CalendarCheck, Truck, PawPrint, ArrowUpRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { getMyKennel, listKennelLitters, listKennelPuppies } from "@/lib/queries/breeder";
import { listReservationsForMyKennel } from "@/lib/queries/reservations";
import { listTransportRequestsForKennel } from "@/lib/queries/transport";

export const Route = createFileRoute("/dashboard/breeder/")({
  component: BreederOverview,
});

function BreederOverview() {
  const { userId } = useAuth();
  const { data: kennel } = useQuery({
    queryKey: ["my-kennel", userId],
    enabled: !!userId,
    queryFn: () => getMyKennel(userId!),
  });

  const { data: litters } = useQuery({
    queryKey: ["kennel-litters", kennel?.id],
    enabled: !!kennel?.id,
    queryFn: () => listKennelLitters(kennel!.id),
  });
  const { data: puppies } = useQuery({
    queryKey: ["kennel-puppies", kennel?.id],
    enabled: !!kennel?.id,
    queryFn: () => listKennelPuppies(kennel!.id),
  });
  const { data: reservations } = useQuery({
    queryKey: ["kennel-reservations", kennel?.id],
    enabled: !!kennel?.id,
    queryFn: () => listReservationsForMyKennel(kennel!.id),
  });
  const { data: transportRequests } = useQuery({
    queryKey: ["kennel-transport-requests", kennel?.id],
    enabled: !!kennel?.id,
    queryFn: () => listTransportRequestsForKennel(kennel!.id),
  });

  const activePuppies = (puppies ?? []).filter(
    (p) => p.availability_status !== "sold" && p.availability_status !== "withdrawn",
  ).length;
  const pendingReservations = (reservations ?? []).filter(
    (r) => r.status === "awaiting_buyer" || r.status === "awaiting_breeder",
  ).length;

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">
          {kennel?.name ? `Welcome back, ${kennel.name}` : "Welcome back"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Here's what's happening in your kennel today.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={PawPrint} label="Litters" value={litters?.length ?? 0} />
        <Kpi icon={Dog} label="Active puppies" value={activePuppies} />
        <Kpi
          icon={CalendarCheck}
          label="Reservations awaiting action"
          value={pendingReservations}
        />
        <Kpi icon={Truck} label="Transport requests" value={transportRequests?.length ?? 0} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card title="Recent litters" cta="View all" ctaTo="/dashboard/breeder/litters">
          {!litters?.length ? (
            <p className="text-sm text-muted-foreground">
              No litters yet. Start from the Litters page.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {litters.slice(0, 5).map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <div className="font-medium">{l.code}</div>
                    <div className="text-xs text-muted-foreground">
                      {l.breeds?.name ?? "Breed not set"} · {l.totalPuppies} puppies
                    </div>
                  </div>
                  <StatusPill status={l.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Reservations" cta="View all" ctaTo="/dashboard/breeder/reservations">
          {!reservations?.length ? (
            <p className="text-sm text-muted-foreground">No reservations yet.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {reservations.slice(0, 5).map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <div className="font-medium">
                      {r.buyerName}{" "}
                      <span className="text-xs text-muted-foreground">for {r.puppyName}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{r.buyerCity}</div>
                  </div>
                  <StatusPill status={r.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
}) {
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
    </div>
  );
}

export function Card({
  title,
  cta,
  ctaTo,
  children,
}: {
  title: string;
  cta?: string;
  ctaTo?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">{title}</h3>
        {cta && ctaTo && (
          <Link to={ctaTo} className="text-xs text-primary hover:underline">
            {cta}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

const statusPillStyles: Record<string, string> = {
  planned: "bg-accent/15 text-accent",
  born: "bg-accent/15 text-accent",
  applications_open: "bg-warning/20 text-foreground",
  fully_reserved: "bg-success/15 text-success",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
  awaiting_buyer: "bg-warning/20 text-foreground",
  awaiting_breeder: "bg-warning/20 text-foreground",
  available: "bg-success/15 text-success",
  adopted: "bg-muted text-muted-foreground",
  sold: "bg-muted text-muted-foreground",
  reserved: "bg-warning/20 text-foreground",
  draft: "bg-muted text-muted-foreground",
  withdrawn: "bg-destructive/10 text-destructive",
  unavailable: "bg-destructive/10 text-destructive",
  confirmed: "bg-success/15 text-success",
  // Kept for dashboard.breeder.applications.tsx, still on mock data until buyer_applications gets wired up.
  new: "bg-accent/15 text-accent",
  "in-review": "bg-warning/20 text-foreground",
  approved: "bg-success/15 text-success",
  "waiting-list": "bg-muted text-muted-foreground",
  rejected: "bg-destructive/10 text-destructive",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusPillStyles[status] ?? "bg-muted text-muted-foreground"}`}
    >
      {status.replace(/[_-]/g, " ")}
    </span>
  );
}
