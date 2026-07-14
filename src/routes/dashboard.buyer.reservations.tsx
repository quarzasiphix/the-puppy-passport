import { createFileRoute } from "@tanstack/react-router";
import { reservations } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/dashboard/buyer/reservations")({
  component: BuyerReservations,
});

function BuyerReservations() {
  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">Reservations</h1>
      </header>
      <div className="space-y-3">
        {reservations.map((r) => (
          <div key={r.id} className="rounded-2xl border border-border/70 bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-display text-lg font-semibold">{r.puppy}</div>
                <div className="text-sm text-muted-foreground">Reserved {new Date(r.reservationDate).toLocaleDateString("en-GB")} · Collection {new Date(r.collectionDate).toLocaleDateString("en-GB")}</div>
              </div>
              <Badge variant="secondary">{r.status}</Badge>
            </div>
            <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
              <div><span className="text-muted-foreground">Deposit: </span>{r.deposit}</div>
              <div><span className="text-muted-foreground">Agreement: </span>{r.agreement}</div>
              <div><span className="text-muted-foreground">Documents: </span>{r.documents}</div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button size="sm">Continue reservation</Button>
              <Button size="sm" variant="outline">Document checklist</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
