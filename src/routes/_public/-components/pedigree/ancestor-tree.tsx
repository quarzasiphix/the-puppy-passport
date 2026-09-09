import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Minus, Plus, HelpCircle } from "lucide-react";

import type { AncestorNode, PedigreeVerificationLevel } from "@/domains/pedigrees";
import type { AncestorTree } from "@/domains/pedigrees";
import { Button } from "@/shared/ui/button";
import { useTranslation } from "@/shared/i18n";

const LEVEL_STYLES: Record<PedigreeVerificationLevel, string> = {
  registry_verified: "border-success/40 bg-success/10 text-success",
  breeder_confirmed: "border-success/30 bg-success/5 text-foreground",
  document_supported: "border-accent/30 bg-accent/5 text-foreground",
  community_supported: "border-border bg-card text-foreground",
  unverified: "border-border bg-card text-muted-foreground",
  disputed: "border-warning/50 bg-warning/10 text-foreground",
};

function levelLabel(t: (k: string) => string, level: PedigreeVerificationLevel): string {
  return t(`pedigree.verificationLevel.${level}`);
}

/** Flatten the tree into generation columns (breadth-first), so it renders as the familiar
 * pedigree grid but collapses cleanly to a horizontally-scrollable strip on a phone. */
function toColumns(tree: AncestorTree, maxGen: number): AncestorNode[][] {
  const columns: AncestorNode[][] = [];
  let level: (AncestorNode | null)[] = [tree.sire ?? null, tree.dam ?? null];
  for (let gen = 1; gen <= maxGen; gen++) {
    const filled = level.map(
      (n, i) =>
        n ?? {
          slotKey: `gen${gen}-${i}`,
          role: i % 2 === 0 ? ("sire" as const) : ("dam" as const),
          dog: null,
          edgeId: null,
          edgeVerificationLevel: null,
          edgeStatus: null,
        },
    );
    columns.push(filled);
    level = filled.flatMap((n) => [n.sire ?? null, n.dam ?? null]);
  }
  return columns;
}

function AncestorCard({
  node,
  canContribute,
  rootSlug,
}: {
  node: AncestorNode;
  canContribute: boolean;
  rootSlug: string | null;
}) {
  const { t } = useTranslation();
  const level = node.edgeVerificationLevel ?? "unverified";

  if (!node.dog) {
    return (
      <div className="flex min-h-[68px] flex-col justify-center rounded-xl border border-dashed border-border/70 bg-secondary/40 px-3 py-2">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <HelpCircle className="size-3.5" /> {t("pedigree.tree.unknown")}
        </span>
        {canContribute && (
          <Link
            to="/pedigrees/add"
            search={rootSlug ? { subject: rootSlug } : undefined}
            className="mt-1 text-[11px] font-medium text-accent underline-offset-2 hover:underline"
          >
            {t("pedigree.tree.addThisAncestor")}
          </Link>
        )}
      </div>
    );
  }

  const dog = node.dog;
  return (
    <Link
      to="/dogs/$slug"
      params={{ slug: dog.slug ?? dog.id }}
      className={`block min-h-[68px] rounded-xl border px-3 py-2 transition-colors hover:border-accent ${LEVEL_STYLES[level]}`}
    >
      <div className="truncate text-sm font-semibold text-foreground">{dog.registeredName}</div>
      <div className="truncate text-[11px] text-muted-foreground">
        {dog.pedigreeNumber || dog.kennelName || "—"}
      </div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wide">
        {node.edgeStatus === "disputed"
          ? t("pedigree.verificationLevel.disputed")
          : levelLabel(t, level)}
      </div>
    </Link>
  );
}

export function AncestorTreeView({
  tree,
  canContribute,
}: {
  tree: AncestorTree;
  canContribute: boolean;
}) {
  const { t } = useTranslation();
  const [visibleGen, setVisibleGen] = useState(Math.min(3, tree.generations));
  const columns = useMemo(() => toColumns(tree, visibleGen), [tree, visibleGen]);

  const genLabels = [
    t("pedigree.tree.parents"),
    t("pedigree.tree.grandparents"),
    t("pedigree.tree.greatGrandparents"),
    t("pedigree.tree.gen4"),
    t("pedigree.tree.gen5"),
    t("pedigree.tree.gen6"),
    t("pedigree.tree.gen7"),
    t("pedigree.tree.gen8"),
  ];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-muted-foreground">
          {t("pedigree.tree.generationsShown")}: {visibleGen}
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="outline"
            className="size-8"
            disabled={visibleGen <= 1}
            onClick={() => setVisibleGen((g) => Math.max(1, g - 1))}
            aria-label={t("pedigree.tree.showFewer")}
          >
            <Minus className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="size-8"
            disabled={visibleGen >= tree.generations}
            onClick={() => setVisibleGen((g) => Math.min(tree.generations, g + 1))}
            aria-label={t("pedigree.tree.showMore")}
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-3">
          {columns.map((col, gen) => (
            <div key={gen} className="w-44 flex-none sm:w-52">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {genLabels[gen]}
              </div>
              <div
                className="grid gap-2"
                style={{ gridTemplateRows: `repeat(${col.length}, minmax(0, 1fr))` }}
              >
                {col.map((node) => (
                  <AncestorCard
                    key={node.slotKey}
                    node={node}
                    canContribute={canContribute}
                    rootSlug={tree.root.slug}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
