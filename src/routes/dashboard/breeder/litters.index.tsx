import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { useAuth } from "@/domains/identity";
import {
  getMyKennel,
  listKennelLitters,
  litterStatusLabel,
  ParentAvatarPair,
  type LitterRow,
} from "@/domains/breeders";
import { LitterFormDialog } from "@/domains/animals";
import { useTranslation } from "@/shared/i18n";

export const Route = createFileRoute("/dashboard/breeder/litters/")({
  component: LittersPage,
});

type LitterStatus = LitterRow["status"];

function LittersPage() {
  const { userId } = useAuth();
  const { t, locale } = useTranslation();
  const dateLocale = locale === "pl" ? "pl-PL" : "en-GB";

  const TABS: {
    key: "active" | "planned" | "completed";
    label: string;
    match: (s: LitterStatus) => boolean;
  }[] = [
    {
      key: "active",
      label: t("breederPanel.litters.tabActive"),
      match: (s) => s === "born" || s === "applications_open" || s === "fully_reserved",
    },
    { key: "planned", label: t("breederPanel.litters.tabPlanned"), match: (s) => s === "planned" },
    {
      key: "completed",
      label: t("breederPanel.litters.tabCompleted"),
      match: (s) => s === "completed" || s === "cancelled",
    },
  ];

  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("active");
  const activeTab = TABS.find((tb) => tb.key === tab)!;

  const { data: kennel } = useQuery({
    queryKey: ["my-kennel", userId],
    enabled: !!userId,
    queryFn: () => getMyKennel(userId!),
  });
  const { data: litters, isLoading } = useQuery({
    queryKey: ["kennel-litters", kennel?.id],
    enabled: !!kennel?.id,
    queryFn: () => listKennelLitters(kennel!.id),
  });

  const filtered = (litters ?? []).filter((l) => activeTab.match(l.status));

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">
          {t("breederPanel.litters.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("breederPanel.litters.subtitle")}</p>
      </header>

      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-secondary p-1">
        {TABS.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`h-12 rounded-xl text-sm font-bold transition ${
              tab === tb.key ? "bg-card text-primary shadow-sm" : "text-muted-foreground"
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {kennel?.id && (
        <div className="grid gap-2 sm:grid-cols-2">
          <LitterFormDialog
            kennelId={kennel.id}
            defaultStatus="planned"
            trigger={
              <Button
                variant="outline"
                className="h-14 w-full rounded-2xl border-2 text-base font-bold"
              >
                {t("breederPanel.litters.addPlanned")}
              </Button>
            }
          />
          <LitterFormDialog
            kennelId={kennel.id}
            defaultStatus="born"
            trigger={
              <Button className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold shadow-sm">
                <Plus className="size-5" /> {t("breederPanel.litters.addLitter")}
              </Button>
            }
          />
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("breederPanel.litters.loading")}</p>
      ) : !filtered.length ? (
        <div className="rounded-3xl border-2 border-dashed border-border bg-card/50 p-8 text-center">
          <p className="text-base font-semibold">
            {!litters?.length
              ? t("breederPanel.litters.emptyNoLitters")
              : t("breederPanel.litters.emptyFilterNoMatch")}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((l) => (
            <Link
              key={l.id}
              to="/dashboard/breeder/litters/$id"
              params={{ id: l.id }}
              className="block overflow-hidden rounded-3xl bg-card shadow-sm transition hover:shadow-md"
            >
              <div className="flex gap-3 p-4">
                <ParentAvatarPair mother={l.mother} father={l.father} />
                <div className="min-w-0 flex-1 pl-1">
                  <h3 className="truncate font-display text-lg font-bold leading-tight">
                    {l.code}
                  </h3>
                  <p className="truncate text-xs text-muted-foreground">
                    {l.mother?.registered_name ?? t("breederPanel.litters.motherNotSet")} ×{" "}
                    {l.father?.registered_name ?? t("breederPanel.litters.fatherNotSet")}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Badge variant="secondary">{litterStatusLabel(t, l.status)}</Badge>
                    {!l.is_published && (
                      <Badge variant="outline">{t("breederPanel.litters.draftBadge")}</Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 border-t border-border/60 bg-secondary/40 px-4 py-3 text-xs">
                <div>
                  <p className="text-muted-foreground">
                    {l.birth_date
                      ? t("breederPanel.litters.born")
                      : t("breederPanel.litters.expected")}
                  </p>
                  <p className="font-bold">
                    {(l.birth_date ?? l.expected_birth_date)
                      ? new Date((l.birth_date ?? l.expected_birth_date)!).toLocaleDateString(
                          dateLocale,
                        )
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("breederPanel.litters.puppiesLabel")}</p>
                  <p className="font-bold">
                    {l.totalPuppies || l.puppy_count || "—"}{" "}
                    {l.totalPuppies > 0 && (
                      <span className="font-normal text-muted-foreground">
                        ({l.availablePuppies} {t("breederPanel.litters.availSuffix")})
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("breederPanel.litters.breedLabel")}</p>
                  <p className="truncate font-bold">{l.breeds?.name ?? "—"}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
