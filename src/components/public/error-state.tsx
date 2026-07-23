import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Consolidates the "this failed, not just empty" pattern duplicated across ~8 public/buyer-facing
// pages — always distinct from EmptyState (destructive-tinted, never the dashed "nothing here"
// style) so a real query failure is never visually indistinguishable from an honest empty result.
export function ErrorState({
  title,
  description,
  action,
  compact = false,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-destructive/30 bg-destructive/5 text-center",
        compact ? "p-6 text-sm" : "p-10",
        className,
      )}
    >
      <p className="font-medium">{title}</p>
      {description && (
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className={cn(compact ? "mt-3" : "mt-4")}>{action}</div>}
    </div>
  );
}
