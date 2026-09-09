import type { LucideIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils";

// One shared empty-state treatment for every tab on the breeder profile. Giving it an optional
// icon + title (rather than just a line of muted text) is a deliberate small upgrade — a bare
// sentence in a dashed box reads like a placeholder that was never finished; an icon-in-a-circle
// plus a short heading reads as an intentional "nothing here yet" state. `children` stays the
// explanatory sentence, unchanged in meaning from before — no copy here fabricates data.
export function EmptyState({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon?: LucideIcon;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed border-border/70 bg-secondary/30 px-8 py-12 text-center",
        className,
      )}
    >
      {Icon && (
        <span className="mx-auto mb-3 grid size-11 place-items-center rounded-full bg-background text-muted-foreground">
          <Icon className="size-5" />
        </span>
      )}
      {title && <p className="font-display text-base font-medium">{title}</p>}
      <p className={cn("mx-auto max-w-sm text-sm text-muted-foreground", title && "mt-1")}>
        {children}
      </p>
    </div>
  );
}
