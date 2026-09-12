import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Award } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { useAuth } from "@/domains/identity";
import { getMyKennel, listKennelAchievements } from "@/domains/breeders";
import { AchievementFormDialog } from "@/domains/animals";
import { useTranslation } from "@/shared/i18n";

export const Route = createFileRoute("/dashboard/breeder/achievements")({
  component: AchievementsPage,
});

const statusStyles: Record<string, string> = {
  pending: "bg-accent/15 text-accent",
  approved: "bg-success/15 text-success",
  rejected: "bg-destructive/10 text-destructive",
};

function getStatusLabels(t: (key: string) => string): Record<string, string> {
  return {
    pending: t("breederPanel.achievements.statusPending"),
    approved: t("breederPanel.achievements.statusApproved"),
    rejected: t("breederPanel.achievements.statusRejected"),
  };
}

function AchievementsPage() {
  const { t } = useTranslation();
  const statusLabels = getStatusLabels(t);
  const { userId } = useAuth();
  const { data: kennel } = useQuery({
    queryKey: ["my-kennel", userId],
    enabled: !!userId,
    queryFn: () => getMyKennel(userId!),
  });
  const { data: achievements, isLoading } = useQuery({
    queryKey: ["kennel-achievements", kennel?.id],
    enabled: !!kennel?.id,
    queryFn: () => listKennelAchievements(kennel!.id),
  });

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-medium">{t("breederPanel.achievements.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("breederPanel.achievements.subtitle")}</p>
        </div>
        {kennel?.id && (
          <AchievementFormDialog
            kennelId={kennel.id}
            trigger={<Button>{t("breederPanel.achievements.addAchievement")}</Button>}
          />
        )}
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("breederPanel.achievements.loading")}</p>
      ) : !achievements?.length ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-8 text-center">
          <Award className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            {t("breederPanel.achievements.emptyBody")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {achievements.map((a) => (
            <div key={a.id} className="rounded-2xl border border-border/70 bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-medium">
                    {a.title}{" "}
                    <span className="text-sm text-muted-foreground">
                      — {a.parent_dogs?.registered_name ?? t("breederPanel.achievements.unknownDog")}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {[
                      a.issuing_body,
                      a.achieved_on && new Date(a.achieved_on).toLocaleDateString("en-GB"),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  {a.verification_status === "rejected" && a.admin_notes && (
                    <p className="mt-1 text-xs text-destructive">
                      {t("breederPanel.achievements.notApprovedPrefix")} {a.admin_notes}
                    </p>
                  )}
                </div>
                <Badge className={statusStyles[a.verification_status]}>
                  {statusLabels[a.verification_status] ?? a.verification_status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
