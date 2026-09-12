import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { Badge } from "@/shared/ui/badge";

/**
 * The one "Verified breeder / Verified foundation / Kennel verified" badge shape used everywhere
 * a kennel or organisation's verification actually renders — marketplace cards, the puppy detail
 * page, the public breeder profile. Previously each call site duplicated the same
 * `bg-primary/90 text-primary-foreground` + ShieldCheck markup; centralising it here means the
 * "premium" gentle shine sweep (`.verified-shine`, src/styles.css) is defined once and every real
 * verified badge gets it for free, instead of animating some and not others.
 *
 * Deliberately a fixed trust-green (bg-primary), not a kennel's own brand color — the shine is a
 * site-wide "this is a real, verified account" signal, independent of any one kennel's
 * personalization (that lives in the accent glow/logo ring around it instead, see brand-color.ts).
 */
export function VerifiedBadge({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Badge
      className={`verified-shine border-primary/30 bg-primary/90 text-primary-foreground ${className}`}
    >
      <ShieldCheck className="mr-1 size-3" />
      {children}
    </Badge>
  );
}
