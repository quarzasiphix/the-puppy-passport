import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { transportRequests, transportSteps } from "@/lib/mock-data";
import { ArrowRight, Check } from "lucide-react";

export const Route = createFileRoute("/dashboard/buyer/transport")({
  component: BuyerTransport,
});

function BuyerTransport() {
  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-3xl font-medium">Transport</h1>
        <Button asChild><Link to="/transport/request">Request transport</Link></Button>
      </header>
      <div className="space-y-3">
        {transportRequests.map((t) => (
          <div key={t.id} className="rounded-2xl border border-border/70 bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-display text-lg font-semibold">{t.puppy}</div>
                <div className="text-sm text-muted-foreground">{t.from} <ArrowRight className="mx-1 inline size-3" /> {t.to}</div>
              </div>
              <Badge variant="secondary">{t.status}</Badge>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              {transportSteps.map((s, i) => (
                <span key={s} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${i <= t.step ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {i <= t.step && <Check className="size-3" />} {s}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
