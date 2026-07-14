import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { reservations } from "@/lib/mock-data";

export const Route = createFileRoute("/dashboard/breeder/reservations")({
  component: ReservationsPage,
});

function ReservationsPage() {
  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">Reservations</h1>
        <p className="text-sm text-muted-foreground">Track deposits, agreements and handovers.</p>
      </header>
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-4">Puppy</th>
              <th className="p-4">Buyer</th>
              <th className="p-4">Reserved</th>
              <th className="p-4">Deposit</th>
              <th className="p-4">Agreement</th>
              <th className="p-4">Documents</th>
              <th className="p-4">Collection</th>
              <th className="p-4">Status</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {reservations.map((r) => (
              <tr key={r.id} className="hover:bg-secondary/40">
                <td className="p-4 font-medium">{r.puppy}</td>
                <td className="p-4">{r.buyer}</td>
                <td className="p-4 text-muted-foreground">{new Date(r.reservationDate).toLocaleDateString("en-GB")}</td>
                <td className="p-4"><Badge variant={r.deposit === "paid" ? "default" : "secondary"} className={r.deposit === "paid" ? "bg-success/15 text-success" : ""}>{r.deposit}</Badge></td>
                <td className="p-4"><Badge variant="secondary" className="capitalize">{r.agreement}</Badge></td>
                <td className="p-4 text-muted-foreground">{r.documents}</td>
                <td className="p-4">{new Date(r.collectionDate).toLocaleDateString("en-GB")}</td>
                <td className="p-4">{r.status}</td>
                <td className="p-4 text-right"><Button size="sm" variant="outline">Open</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
