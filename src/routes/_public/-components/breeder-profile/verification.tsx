import { BadgeCheck } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { trustClaimLabel, trustClaimExplanation } from "@/domains/trust";
import { VerifiedBadge } from "@/domains/breeders";
import { useTranslation } from "@/shared/i18n";
import type { Breeder, Stats, TrustClaims } from "./types";

export function VerificationBadges({ b, trustClaims }: { b: Breeder; trustClaims: TrustClaims }) {
  const { t } = useTranslation();
  const badges: { key: string; label: string; explanation: string }[] = [];
  if (b.verified) {
    badges.push({
      key: "kennel",
      label: t("breederProfile.kennelVerified"),
      explanation: t("breederProfile.kennelVerifiedExplanation"),
    });
  }
  for (const claim of Object.values(trustClaims)) {
    if (claim.status === "verified") {
      badges.push({
        key: claim.claimType,
        label: trustClaimLabel(t, claim.claimType),
        explanation: trustClaimExplanation(t, claim.claimType),
      });
    }
  }
  if (badges.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((v) => (
        <Tooltip key={v.key}>
          <TooltipTrigger asChild>
            <VerifiedBadge className="cursor-help">{v.label}</VerifiedBadge>
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
  const { t } = useTranslation();
  const rows = [
    { label: t("breederProfile.identityVerified"), verified: stats.identityVerified },
    { label: t("breederProfile.kennelVerified"), verified: b.verified },
    {
      label: trustClaimLabel(t, "association"),
      verified: trustClaims.association.status === "verified",
    },
    {
      label: trustClaimLabel(t, "pedigrees"),
      verified: trustClaims.pedigrees.status === "verified",
    },
    {
      label: trustClaimLabel(t, "health_documents"),
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
        {stats.completedHandovers}{" "}
        {stats.completedHandovers === 1
          ? t("breederProfile.handoverSingular")
          : t("breederProfile.handoverPlural")}
      </li>
    </ul>
  );
}
