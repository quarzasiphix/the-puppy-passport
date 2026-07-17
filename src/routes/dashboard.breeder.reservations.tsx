import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { listReservationsForMyKennel } from "@/lib/queries/reservations";

export const Route = createFileRoute("/dashboard/breeder/reservations")({
  component: ReservationsPage,
});

function ReservationsPage() {
  const { userId } = useAuth();
  const { data: orgId } = useQuery({
    queryKey: ["my-kennel-id", userId],
    enabled: !!userId,
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase
        .from("organisations")
        .select("id")
        .eq("owner_user_id", userId!)
        .eq("org_type", "kennel")
        .maybeSingle();
      return data?.id ?? null;
    },
  });
  const { data: reservations, isLoading } = useQuery({
    queryKey: ["kennel-reservations", orgId],
    enabled: !!orgId,
    queryFn: () => listReservationsForMyKennel(orgId!),
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">Reservations</h1>
        <p className="text-sm text-muted-foreground">Track deposits, agreements and handovers.</p>
      </header>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !reservations?.length ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-8 text-center">
          <p className="text-sm text-muted-foreground">No reservations yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-4">Puppy</th>
                <th className="p-4">Buyer</th>
                <th className="p-4">Deposit</th>
                <th className="p-4">Agreement</th>
                <th className="p-4">Collection</th>
                <th className="p-4">Status</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {reservations.map((r) => (
                <tr key={r.id} className="hover:bg-secondary/40">
                  <td className="p-4 font-medium">{r.puppyName}</td>
                  <td className="p-4">{r.buyerName}</td>
                  <td className="p-4">
                    <Badge
                      variant={r.depositStatus === "paid" ? "default" : "secondary"}
                      className={r.depositStatus === "paid" ? "bg-success/15 text-success" : ""}
                    >
                      {r.depositStatus.replace(/_/g, " ")}
                    </Badge>
                  </td>
                  <td className="p-4">
                    <Badge variant="secondary" className="capitalize">
                      {r.agreementStatus.replace(/_/g, " ")}
                    </Badge>
                  </td>
                  <td className="p-4 text-muted-foreground">
                    {r.plannedCollectionDate
                      ? new Date(r.plannedCollectionDate).toLocaleDateString("en-GB")
                      : "Not set"}
                  </td>
                  <td className="p-4 capitalize">{r.status.replace(/_/g, " ")}</td>
                  <td className="p-4 text-right">
                    {r.status === "confirmed" && (
                      <Button size="sm" variant="outline" asChild>
                        <Link to="/transport/request" search={{ animalId: r.animalId }}>
                          Request transport
                        </Link>
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
