import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { buyerApplications } from "@/lib/mock-data";

export const Route = createFileRoute("/dashboard/buyer/applications")({
  component: BuyerApplications,
});

function BuyerApplications() {
  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">Your applications</h1>
      </header>
      <ul className="space-y-3">
        {buyerApplications.map((a) => (
          <li key={a.id} className="rounded-2xl border border-border/70 bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-display text-lg font-semibold">{a.puppyName}</div>
                <div className="text-sm text-muted-foreground">{a.kennel} · Applied {new Date(a.date).toLocaleDateString("en-GB")}</div>
              </div>
              <Badge variant="secondary">{a.status}</Badge>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{a.note}</p>
            <div className="mt-4 flex gap-2">
              <Button asChild size="sm" variant="outline"><Link to="/puppies/$id" params={{ id: a.puppyId }}>Open puppy</Link></Button>
              <Button size="sm" variant="outline">Message breeder</Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
