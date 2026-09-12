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
 * `accentColor`, when passed, matches the badge to that kennel's own brand color instead of the
 * fixed site trust-green (product decision 2026-09-12, reversing this component's earlier
 * "deliberately never branded" stance) — applied as an inline style, never a `bg-accent`-style
 * Tailwind class, because this badge also renders on mixed, multi-kennel pages (find-a-dog) where
 * there's no single page-level `--accent` override to read; an inline style is correct on both a
 * single-kennel page and a shared grid. Omit `accentColor` (or pass none) to keep the neutral
 * trust-green — used for foundation/adoption badges and other non-breeder-specific contexts.
 */
export function VerifiedBadge({
  children,
  className = "",
  accentColor,
}: {
  children: ReactNode;
  className?: string;
  accentColor?: string | null;
}) {
  return (
    <Badge
      className={`verified-shine ${
        accentColor ? "text-white" : "border-primary/30 bg-primary/90 text-primary-foreground"
      } ${className}`}
      style={
        accentColor
          ? { backgroundColor: accentColor, borderColor: `${accentColor}4d` }
          : undefined
      }
    >
      <ShieldCheck className="mr-1 size-3" />
      {children}
    </Badge>
  );
}
