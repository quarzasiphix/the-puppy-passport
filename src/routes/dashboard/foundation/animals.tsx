import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { useAuth } from "@/domains/identity";
import { getMyFoundation, listFoundationAnimals, updateAdoptionAnimal } from "@/domains/breeders";
import { AdoptionFormDialog } from "@/domains/marketplace";
import { useTranslation } from "@/shared/i18n";

import { getFriendlyErrorMessage } from "@/shared/lib/errors";
export const Route = createFileRoute("/dashboard/foundation/animals")({
  component: AnimalsPage,
});

function AnimalsPage() {
  const { t } = useTranslation();
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  const { data: org } = useQuery({
    queryKey: ["my-foundation", userId],
    enabled: !!userId,
    queryFn: () => getMyFoundation(userId!),
  });
  const { data: animals, isLoading } = useQuery({
    queryKey: ["foundation-animals", org?.id],
    enabled: !!org?.id,
    queryFn: () => listFoundationAnimals(org!.id),
  });

  const publishMutation = useMutation({
    mutationFn: ({ id, isPublished }: { id: string; isPublished: boolean }) =>
      updateAdoptionAnimal(id, {
        is_published: isPublished,
        availability_status: isPublished ? "available" : "draft",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["foundation-animals"] });
      toast.success(t("foundationPanel.animalsPage.updatedToast"));
    },
    onError: (err) =>
      toast.error(getFriendlyErrorMessage(err, t("foundationPanel.animalsPage.updateFailed"))),
  });

  const adoptedMutation = useMutation({
    mutationFn: (id: string) => updateAdoptionAnimal(id, { availability_status: "adopted" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["foundation-animals"] });
      toast.success(t("foundationPanel.animalsPage.adoptedToast"));
    },
    onError: (err) =>
      toast.error(getFriendlyErrorMessage(err, t("foundationPanel.animalsPage.updateFailed"))),
  });

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-medium">
            {t("foundationPanel.animalsPage.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("foundationPanel.animalsPage.subtitle")}
          </p>
        </div>
        {org?.id && (
          <AdoptionFormDialog
            orgId={org.id}
            trigger={<Button>{t("foundationPanel.animalsPage.addAnimal")}</Button>}
          />
        )}
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("foundationPanel.animalsPage.loading")}</p>
      ) : !animals?.length ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {t("foundationPanel.animalsPage.emptyBody")}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {animals.map((a) => (
            <article
              key={a.id}
              className="overflow-hidden rounded-2xl border border-border/70 bg-card"
            >
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-display text-lg font-semibold">{a.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.breeds?.name ?? t("foundationPanel.animalsPage.mixedBreed")} ·{" "}
                      {a.sex ?? t("foundationPanel.animalsPage.sexNotSet")}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="secondary" className="capitalize">
                      {a.availability_status.replace(/_/g, " ")}
                    </Badge>
                    {!a.is_published && (
                      <Badge variant="outline" className="text-xs">
                        {t("foundationPanel.animalsPage.draftBadge")}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <AdoptionFormDialog
                    orgId={org!.id}
                    animal={a}
                    trigger={
                      <Button size="sm" variant="outline">
                        {t("foundationPanel.animalsPage.editButton")}
                      </Button>
                    }
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={publishMutation.isPending}
                    onClick={() =>
                      publishMutation.mutate({ id: a.id, isPublished: !a.is_published })
                    }
                  >
                    {a.is_published
                      ? t("foundationPanel.animalsPage.unpublishButton")
                      : t("foundationPanel.animalsPage.publishButton")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled
                    title={t("foundationPanel.animalsPage.applicationsComingSoon")}
                  >
                    {t("foundationPanel.animalsPage.applicationsButton")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={adoptedMutation.isPending || a.availability_status === "adopted"}
                    onClick={() => adoptedMutation.mutate(a.id)}
                  >
                    {t("foundationPanel.animalsPage.markAdoptedButton")}
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
