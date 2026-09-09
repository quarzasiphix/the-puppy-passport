import { useTranslation } from "@/shared/i18n";
import type { Parents } from "./types";

export function ParentDogCard({ p }: { p: Parents[number] }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5">
      <div className="flex gap-4">
        <img src={p.image} alt="" className="size-24 shrink-0 rounded-xl object-cover" />
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wide text-accent">
            {p.sex === "female" ? t("breederProfile.female") : t("breederProfile.male")}
          </div>
          <h4 className="mt-1 font-display text-lg font-semibold">{p.name}</h4>
          {p.pedigree && <p className="text-xs text-muted-foreground">{p.pedigree}</p>}
          {p.description && <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>}
        </div>
      </div>
    </div>
  );
}
