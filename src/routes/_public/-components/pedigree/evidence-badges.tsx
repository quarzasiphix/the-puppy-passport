import { FileCheck2, ShieldQuestion, Dna, Landmark, AlertTriangle, Link2 } from "lucide-react";

import type { DogEvidenceSummary } from "@/domains/pedigrees";
import { useTranslation } from "@/shared/i18n";

/**
 * Precise, non-overclaiming evidence indicators. Only a badge for evidence that actually exists;
 * there is deliberately no blanket "Verified" badge. When nothing is verified we say so plainly
 * ("Registry not independently verified", "DNA not verified") rather than showing nothing.
 */
export function EvidenceBadges({ evidence }: { evidence: DogEvidenceSummary }) {
  const { t } = useTranslation();

  const positives: { key: string; icon: typeof FileCheck2; label: string }[] = [];
  if (evidence.hasPedigreeDocument) {
    positives.push({
      key: "doc",
      icon: FileCheck2,
      label: t("pedigree.evidence.documentSupplied"),
    });
  }
  if (evidence.parentRelationshipSupportedBySource) {
    positives.push({
      key: "rel",
      icon: Link2,
      label: t("pedigree.evidence.relationshipSupported"),
    });
  }
  if (evidence.registryVerified) {
    positives.push({
      key: "registry",
      icon: Landmark,
      label: t("pedigree.evidence.registryVerified"),
    });
  }
  if (evidence.dnaVerified) {
    positives.push({ key: "dna", icon: Dna, label: t("pedigree.evidence.dnaVerified") });
  }

  const cautions: { key: string; icon: typeof ShieldQuestion; label: string }[] = [];
  if (!evidence.registryVerified) {
    cautions.push({
      key: "no-registry",
      icon: ShieldQuestion,
      label: t("pedigree.evidence.registryNotVerified"),
    });
  }
  if (!evidence.dnaVerified) {
    cautions.push({ key: "no-dna", icon: Dna, label: t("pedigree.evidence.dnaNotVerified") });
  }
  if (evidence.hasDisputedRelationship) {
    cautions.push({
      key: "disputed",
      icon: AlertTriangle,
      label: t("pedigree.evidence.hasDisputed"),
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {positives.map(({ key, icon: Icon, label }) => (
        <span
          key={key}
          className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-medium text-success"
        >
          <Icon className="size-3.5" /> {label}
        </span>
      ))}
      {cautions.map(({ key, icon: Icon, label }) => (
        <span
          key={key}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs font-medium text-muted-foreground"
        >
          <Icon className="size-3.5" /> {label}
        </span>
      ))}
    </div>
  );
}
