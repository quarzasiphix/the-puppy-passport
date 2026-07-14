import { createFileRoute } from "@tanstack/react-router";
import { FileText, Check, Circle } from "lucide-react";

export const Route = createFileRoute("/dashboard/buyer/documents")({
  component: BuyerDocs,
});

const checklist = [
  ["Buyer identity", true],
  ["Sales agreement (signed)", true],
  ["Deposit receipt", true],
  ["Pedigree copy", false],
  ["Health book", false],
  ["Transport confirmation", false],
] as const;

function BuyerDocs() {
  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">Documents</h1>
        <p className="text-sm text-muted-foreground">Everything needed for a smooth handover.</p>
      </header>
      <div className="rounded-2xl border border-border/70 bg-card p-6">
        <div className="mb-4 font-display text-lg font-semibold">Reservation for Bella — Srebrna Rzeka</div>
        <ul className="divide-y divide-border/60">
          {checklist.map(([name, done]) => (
            <li key={name} className="flex items-center gap-3 py-3">
              <span className={`grid size-9 place-items-center rounded-xl ${done ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground"}`}>
                {done ? <Check className="size-4" /> : <Circle className="size-4" />}
              </span>
              <span className="flex-1 text-sm font-medium">{name}</span>
              <FileText className="size-4 text-muted-foreground" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
