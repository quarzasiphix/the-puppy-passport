import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Consolidates a pattern that had drifted into ~20 near-identical hand-rolled copies across public
// and buyer-dashboard pages (same border/background/padding, icon + title + description + optional
// action). Each call site still supplies its own specific copy/icon/action — this only removes the
// structural duplication, not the per-page meaning (see docs/FRONTEND_DESIGN_SYSTEM.md).
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-10 text-center",
        className,
      )}
    >
      {Icon && <Icon className="mx-auto size-8 text-muted-foreground" />}
      <p className={cn("font-medium", Icon && "mt-3")}>{title}</p>
      {description && (
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1">{action}</div>}
    </div>
  );
}
