import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Dog, CalendarCheck, Truck, PawPrint, Baby, Inbox, User, ArrowRight } from "lucide-react";
import { useAuth } from "@/domains/identity";
import {
  getMyKennel,
  listKennelLitters,
  listKennelPuppies,
  animalCoverPhotoUrl,
  QuickActionTile,
  BigStat,
  ParentAvatarPair,
} from "@/domains/breeders";
import { listTransportRequestsForKennel } from "@/domains/transport";
import {
  listReservationsForMyKennel,
  isReservationAwaitingBreederAction,
} from "@/domains/reservations";
import { Badge } from "@/shared/ui/badge";

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

  const recentLitters = (litters ?? []).slice(0, 3);
  const recentPuppies = (puppies ?? []).slice(0, 3);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">
          {kennel?.name ? `Welcome back, ${kennel.name}` : "Welcome back"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Here's what's happening in your kennel today.
        </p>
      </header>

      {/* Big action tiles — the 4 things a breeder does most often, one tap away */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <QuickActionTile
          to="/dashboard/breeder/puppies"
          label="Add a puppy"
          icon={PawPrint}
          tone="primary"
        />
        <QuickActionTile
          to="/dashboard/breeder/litters"
          label="Add a litter"
          icon={Baby}
          tone="accent"
        />
        <QuickActionTile
          to="/dashboard/breeder/applications"
          label="Buyer applications"
          icon={Inbox}
          tone="success"
        />
        <QuickActionTile
          to="/dashboard/breeder/profile"
          label="My kennel profile"
          icon={User}
          tone="warning"
        />
      </section>

      {/* Summary numbers */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <BigStat icon={Baby} label="Litters" value={litters?.length ?? 0} tone="accent" />
        <BigStat icon={Dog} label="Active puppies" value={activePuppies} tone="primary" />
        <BigStat
          icon={CalendarCheck}
          label="Reservations to review"
          value={pendingReservations}
          tone="success"
        />
        <BigStat
          icon={Truck}
          label="Transport requests"
          value={transportRequests?.length ?? 0}
          tone="warning"
        />
      </section>

      {/* Recent litters */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-xl font-bold">Recent litters</h2>
          <Link
            to="/dashboard/breeder/litters"
            className="text-sm font-semibold text-primary hover:underline"
          >
            See all
          </Link>
        </div>
        {!recentLitters.length ? (
          <EmptyRow text="No litters yet. Add your first one to get started." />
        ) : (
          <div className="space-y-3">
            {recentLitters.map((l) => (
              <Link
                key={l.id}
                to="/dashboard/breeder/litters/$id"
                params={{ id: l.id }}
                className="flex items-center gap-3 rounded-3xl bg-card p-3 shadow-sm transition hover:shadow-md"
              >
                <ParentAvatarPair mother={l.mother} father={l.father} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-lg font-bold">{l.code}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {l.breeds?.name ?? "Breed not set"} · {l.totalPuppies} puppies
                  </p>
                  <Badge variant="secondary" className="mt-1 capitalize">
                    {l.status.replace(/_/g, " ")}
                  </Badge>
                </div>
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <ArrowRight className="size-5" />
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Recent puppies */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-xl font-bold">Recently added puppies</h2>
          <Link
            to="/dashboard/breeder/puppies"
            className="text-sm font-semibold text-primary hover:underline"
          >
            See all
          </Link>
        </div>
        {!recentPuppies.length ? (
          <EmptyRow text="No puppies yet — add a litter first, then puppies." />
        ) : (
          <div className="space-y-3">
            {recentPuppies.map((p) => {
              const photo = animalCoverPhotoUrl(p);
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-3xl bg-card p-3 shadow-sm"
                >
                  {photo ? (
                    <img src={photo} alt="" className="size-16 shrink-0 rounded-2xl object-cover" />
                  ) : (
                    <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-secondary text-muted-foreground">
                      <Dog className="size-6" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-lg font-bold">{p.name}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {p.breeds?.name ?? "Breed not set"}
                      {p.litters?.code && ` · ${p.litters.code}`}
                    </p>
                    <Badge variant="secondary" className="mt-1 capitalize">
                      {p.availability_status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <Link
                    to="/dashboard/breeder/puppies"
                    className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                    aria-label="Open puppies"
                  >
                    <ArrowRight className="size-5" />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-border bg-card/50 p-6 text-center">
      <p className="text-sm font-medium text-muted-foreground">{text}</p>
    </div>
  );
}
