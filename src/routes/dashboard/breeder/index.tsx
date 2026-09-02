import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Dog, CalendarCheck, Truck, PawPrint } from "lucide-react";
import { useAuth } from "@/domains/identity";
import { getMyKennel, listKennelLitters, listKennelPuppies } from "@/domains/breeders";
import { listTransportRequestsForKennel } from "@/domains/transport";
import {
  listReservationsForMyKennel,
  isReservationAwaitingBreederAction,
} from "@/domains/reservations";
import { Card, Kpi, StatusPill } from "@/shared/ui/panel";

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
  const pendingReservations = (reservations ?? []).filter((r) =>
    isReservationAwaitingBreederAction(r.status),
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
