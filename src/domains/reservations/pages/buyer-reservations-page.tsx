import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { useAuth } from "@/domains/identity";
import {
  findActiveTransportRequestsForAnimals,
  nextActionForStatus,
  transportMilestones,
  milestoneIndexForStatus,
} from "@/domains/transport";
import { listMyReservationsAsBuyer } from "../services/reservations";
import { reservationStatusLabel } from "../status";

export function BuyerReservationsPage() {
  const { userId } = useAuth();
  const { data: reservations, isLoading } = useQuery({
    queryKey: ["my-reservations", userId],
    enabled: !!userId,
    queryFn: () => listMyReservationsAsBuyer(userId!),
  });

  // Once a buyer submits transport for a confirmed reservation, the page needs to say so instead
  // of showing "Request transport" again as if nothing happened — see docs/DECISIONS.md.
  const animalIds = (reservations ?? []).map((r) => r.animalId);
  const transportByAnimalQuery = useQuery({
    queryKey: ["reservation-transport-requests", userId, animalIds],
    enabled: !!userId && animalIds.length > 0,
    queryFn: () => findActiveTransportRequestsForAnimals(userId!, animalIds),
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">Reservations</h1>
      </header>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !reservations?.length ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No reservations yet — once a breeder confirms your application, it will show up here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reservations.map((r) => (
            <div key={r.id} className="rounded-2xl border border-border/70 bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-display text-lg font-semibold">
                    {r.puppyName} — {r.breed}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {r.kennelName}
                    {r.plannedCollectionDate &&
                      ` · Collection ${new Date(r.plannedCollectionDate).toLocaleDateString("en-GB")}`}
                  </div>
                </div>
                <Badge variant="secondary" className="capitalize">
                  {reservationStatusLabel(r.status)}
                </Badge>
              </div>
              <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
                <div>
                  <span className="text-muted-foreground">Deposit: </span>
                  {r.depositStatus.replace(/_/g, " ")}
                </div>
                <div>
                  <span className="text-muted-foreground">Agreement: </span>
                  {r.agreementStatus.replace(/_/g, " ")}
                </div>
                {r.agreedPrice != null && (
                  <div>
                    <span className="text-muted-foreground">Agreed price: </span>
                    {r.agreedPrice} {r.currency}
                  </div>
                )}
              </div>
              {r.status === "confirmed" &&
                (() => {
                  const existing = transportByAnimalQuery.data?.get(r.animalId);
                  if (!existing) {
                    return (
                      <div className="mt-4 flex gap-2">
                        <Button size="sm" asChild>
                          <Link to="/transport/request" search={{ animalId: r.animalId }}>
                            Request transport
                          </Link>
                        </Button>
                      </div>
                    );
                  }
                  const milestoneIndex = milestoneIndexForStatus(existing.status);
                  const stepLabel =
                    milestoneIndex !== null ? transportMilestones[milestoneIndex] : existing.status;
                  return (
                    <div className="mt-4 rounded-xl border border-border/70 bg-secondary/40 p-3 text-sm">
                      <div className="font-medium">
                        Transport already requested{" "}
                        {existing.request_number ? `(${existing.request_number})` : ""}
                      </div>
                      <div className="mt-0.5 text-muted-foreground">
                        {stepLabel} — {nextActionForStatus(existing.status)}
                      </div>
                      <Button size="sm" variant="outline" className="mt-2" asChild>
                        <Link to="/dashboard/buyer/transport">View transport status</Link>
                      </Button>
                    </div>
                  );
                })()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
