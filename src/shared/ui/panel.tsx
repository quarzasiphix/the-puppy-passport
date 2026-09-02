import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

// Generic dashboard layout primitives shared across every workspace (breeder, buyer, foundation,
// operations, admin). Previously these lived inside src/routes/dashboard.breeder.index.tsx and
// were deep-imported by 7 other route files — a route module is not an import target. Moved here
// as part of the domain-oriented restructure (see docs/FRONTEND_ARCHITECTURE.md).

export function Card({
  title,
  cta,
  ctaTo,
  children,
}: {
  title: string;
  cta?: string;
  ctaTo?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">{title}</h3>
        {cta && ctaTo && (
          <Link to={ctaTo} className="text-xs text-primary hover:underline">
            {cta}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export function Kpi({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <ArrowUpRight className="size-4 text-muted-foreground" />
      </div>
      <div className="mt-4 font-display text-3xl font-semibold">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

// A neutral status chip used across dashboard list rows. It is intentionally permissive about the
// string it receives (litter status, reservation status, animal availability, application status)
// — each domain owns the authoritative status vocabulary and its own richer badges; this is only
// the shared visual fallback for compact rows.
const statusPillStyles: Record<string, string> = {
  planned: "bg-accent/15 text-accent",
  born: "bg-accent/15 text-accent",
  applications_open: "bg-warning/20 text-foreground",
  fully_reserved: "bg-success/15 text-success",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
  awaiting_buyer: "bg-warning/20 text-foreground",
  awaiting_breeder: "bg-warning/20 text-foreground",
  available: "bg-success/15 text-success",
  adopted: "bg-muted text-muted-foreground",
  sold: "bg-muted text-muted-foreground",
  reserved: "bg-warning/20 text-foreground",
  draft: "bg-muted text-muted-foreground",
  withdrawn: "bg-destructive/10 text-destructive",
  unavailable: "bg-destructive/10 text-destructive",
  confirmed: "bg-success/15 text-success",
  new: "bg-accent/15 text-accent",
  "in-review": "bg-warning/20 text-foreground",
  approved: "bg-success/15 text-success",
  "waiting-list": "bg-muted text-muted-foreground",
  rejected: "bg-destructive/10 text-destructive",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusPillStyles[status] ?? "bg-muted text-muted-foreground"}`}
    >
      {status.replace(/[_-]/g, " ")}
    </span>
  );
}
