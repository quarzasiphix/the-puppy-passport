import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { useAuth } from "@/domains/identity";
import { getMyKennel, listKennelParentDogs } from "@/domains/breeders";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { ParentDogFormDialog } from "@/domains/animals";

import { getFriendlyErrorMessage } from "@/shared/lib/errors";
import { useTranslation } from "@/shared/i18n";
export const Route = createFileRoute("/dashboard/breeder/parent-dogs")({
  component: ParentDogsPage,
});

function ParentDogsPage() {
  const { t } = useTranslation();
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  const { data: kennel } = useQuery({
    queryKey: ["my-kennel", userId],
    enabled: !!userId,
    queryFn: () => getMyKennel(userId!),
  });
  const { data: parentDogs, isLoading } = useQuery({
    queryKey: ["kennel-parent-dogs", kennel?.id],
    enabled: !!kennel?.id,
    queryFn: () => listKennelParentDogs(kennel!.id),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("parent_dogs")
        .update({ is_active: isActive })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kennel-parent-dogs"] });
      toast.success(t("breederPanel.parentDogs.updated"));
    },
    onError: (err) => toast.error(getFriendlyErrorMessage(err, t("breederPanel.parentDogs.couldNotUpdate"))),
  });

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-medium">{t("breederPanel.parentDogs.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("breederPanel.parentDogs.subtitle")}</p>
        </div>
        {kennel?.id && (
          <ParentDogFormDialog
            kennelId={kennel.id}
            trigger={<Button>{t("breederPanel.parentDogs.addParentDog")}</Button>}
          />
        )}
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("breederPanel.parentDogs.loading")}</p>
      ) : !parentDogs?.length ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-8 text-center">
          <p className="text-sm text-muted-foreground">{t("breederPanel.parentDogs.emptyBody")}</p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {parentDogs.map((p) => (
            <article key={p.id} className="rounded-2xl border border-border/70 bg-card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-display text-lg font-semibold">{p.registered_name}</div>
                  <div className="text-xs text-muted-foreground capitalize">
                    {p.sex}
                    {p.call_name && ` · "${p.call_name}"`}
                  </div>
                </div>
                <Badge variant={p.is_active ? "secondary" : "outline"}>
                  {p.is_active
                    ? t("breederPanel.parentDogs.active")
                    : t("breederPanel.parentDogs.retired")}
                </Badge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <ParentDogFormDialog
                  kennelId={kennel!.id}
                  parentDog={p}
                  trigger={
                    <Button size="sm" variant="outline">
                      {t("breederPanel.parentDogs.edit")}
                    </Button>
                  }
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={toggleActiveMutation.isPending}
                  onClick={() => toggleActiveMutation.mutate({ id: p.id, isActive: !p.is_active })}
                >
                  {p.is_active
                    ? t("breederPanel.parentDogs.retire")
                    : t("breederPanel.parentDogs.reactivate")}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
