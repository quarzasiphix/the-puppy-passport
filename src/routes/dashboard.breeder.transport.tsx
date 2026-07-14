import { createFileRoute } from "@tanstack/react-router";
import { transportRequests, transportSteps } from "@/lib/mock-data";
import { Card } from "./dashboard.breeder.index";
import { Check, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/dashboard/breeder/transport")({
  component: BreederTransportPage,
});

function BreederTransportPage() {
  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">Transport</h1>
        <p className="text-sm text-muted-foreground">Transport requests linked to your reservations.</p>
      </header>
      <div className="space-y-4">
        {transportRequests.map((t) => (
          <Card key={t.id} title={`${t.puppy} — ${t.from} → ${t.to}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="secondary">{t.type}</Badge>
                <span className="text-muted-foreground">Requested {new Date(t.requestedDate).toLocaleDateString("en-GB")}</span>
                <span className="text-muted-foreground">Docs: {t.documents}</span>
              </div>
              <div className="text-right">
                <div className="font-display text-lg font-semibold">€{t.priceEUR}</div>
                <div className="text-xs text-muted-foreground">{t.status}</div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              {transportSteps.map((s, i) => (
                <span key={s} className="inline-flex items-center gap-1">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${i <= t.step ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {i <= t.step && <Check className="size-3" />} {s}
                  </span>
                  {i < transportSteps.length - 1 && <ArrowRight className="size-3 text-muted-foreground" />}
                </span>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
