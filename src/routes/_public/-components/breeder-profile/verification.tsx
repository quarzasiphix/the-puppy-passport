import { ShieldCheck, BadgeCheck } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { TRUST_CLAIM_LABELS, TRUST_CLAIM_EXPLANATIONS } from "@/domains/trust";
import type { Breeder, Stats, TrustClaims } from "./types";

export function VerificationBadges({ b, trustClaims }: { b: Breeder; trustClaims: TrustClaims }) {
  const badges: { key: string; label: string; explanation: string }[] = [];
  if (b.verified) {
    badges.push({
      key: "kennel",
      label: "Kennel verified",
      explanation: "Anemalo has reviewed and approved this kennel's identity and details.",
    });
  }
  for (const claim of Object.values(trustClaims)) {
    if (claim.status === "verified") {
      badges.push({
        key: claim.claimType,
        label: TRUST_CLAIM_LABELS[claim.claimType],
        explanation: TRUST_CLAIM_EXPLANATIONS[claim.claimType],
      });
    }
  }
  if (badges.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((v) => (
        <Tooltip key={v.key}>
          <TooltipTrigger asChild>
            <Badge className="cursor-help gap-1 border-primary/30 bg-primary/90 text-primary-foreground">
              <ShieldCheck className="size-3" /> {v.label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-[240px]">{v.explanation}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

export function VerificationList({
  b,
  trustClaims,
  stats,
}: {
  b: Breeder;
  trustClaims: TrustClaims;
  stats: Stats;
}) {
  const rows = [
    { label: "Identity verified", verified: stats.identityVerified },
    { label: "Kennel verified", verified: b.verified },
    {
      label: TRUST_CLAIM_LABELS.association,
      verified: trustClaims.association.status === "verified",
    },
    { label: TRUST_CLAIM_LABELS.pedigrees, verified: trustClaims.pedigrees.status === "verified" },
    {
      label: TRUST_CLAIM_LABELS.health_documents,
      verified: trustClaims.health_documents.status === "verified",
    },
  ];
  return (
    <ul className="space-y-2 text-sm">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center gap-2">
          {r.verified ? (
            <BadgeCheck className="size-4 shrink-0 text-primary" />
          ) : (
            <span className="size-4 shrink-0 rounded-full border border-border" />
          )}
          <span className={r.verified ? "" : "text-muted-foreground"}>{r.label}</span>
        </li>
      ))}
      <li className="mt-1 border-t border-border/60 pt-2 text-xs text-muted-foreground">
        {stats.completedHandovers} completed{" "}
        {stats.completedHandovers === 1 ? "handover" : "handovers"} through Anemalo
      </li>
    </ul>
  );
}
