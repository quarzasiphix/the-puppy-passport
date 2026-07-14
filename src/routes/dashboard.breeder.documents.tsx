import { createFileRoute } from "@tanstack/react-router";
import { Card } from "./dashboard.breeder.index";
import { FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/dashboard/breeder/documents")({
  component: DocsPage,
});

const docs = [
  ["Sales agreement template.pdf", "Contract", "2 days ago"],
  ["Health record — Litter M.pdf", "Health", "1 week ago"],
  ["Pedigree registration — Amber.pdf", "Pedigree", "2 weeks ago"],
  ["Vaccination schedule 2026.pdf", "Vet", "1 month ago"],
  ["Take-back policy.pdf", "Policy", "3 months ago"],
];

function DocsPage() {
  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium">Documents</h1>
          <p className="text-sm text-muted-foreground">Shared templates and per-puppy paperwork.</p>
        </div>
        <Button>Upload document</Button>
      </header>
      <Card title="All documents">
        <ul className="divide-y divide-border/60">
          {docs.map(([n, cat, when]) => (
            <li key={n} className="flex items-center gap-3 py-3">
              <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><FileText className="size-5" /></span>
              <div className="flex-1">
                <div className="font-medium">{n}</div>
                <div className="text-xs text-muted-foreground">{cat} · {when}</div>
              </div>
              <Button size="sm" variant="outline"><Download className="mr-1 size-4" /> Download</Button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
