import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { useAuth } from "@/domains/identity";
import { listFollowedBreeders, unfollowOrg } from "@/domains/marketplace";

import { getFriendlyErrorMessage } from "@/shared/lib/errors";
import { useTranslation } from "@/shared/i18n";
export const Route = createFileRoute("/dashboard/buyer/followed")({
  component: FollowedBreeders,
});

function FollowedBreeders() {
  const { t } = useTranslation();
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["my-followed-breeders", userId],
    enabled: !!userId,
    queryFn: () => listFollowedBreeders(userId!),
  });

  const unfollowMutation = useMutation({
    mutationFn: (orgId: string) => unfollowOrg(userId!, orgId),
    onSuccess: () => {
      toast.success(t("buyerPanel.followed.unfollowed"));
      queryClient.invalidateQueries({ queryKey: ["my-followed-breeders", userId] });
      queryClient.invalidateQueries({ queryKey: ["followed-org-ids", userId] });
    },
    onError: (err) => toast.error(getFriendlyErrorMessage(err, t("buyerPanel.followed.couldNotUpdate"))),
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">{t("buyerPanel.followed.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("buyerPanel.followed.subtitle")}</p>
      </header>
      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("buyerPanel.followed.loading")}</p>
      ) : !query.data?.length ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-10 text-center">
          <p className="font-medium">{t("buyerPanel.followed.emptyTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("buyerPanel.followed.emptyBody")}</p>
          <Link to="/breeders" className="mt-3 inline-block text-sm text-primary hover:underline">
            {t("buyerPanel.followed.browseBreeders")}
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {query.data.map((b) => (
            <div key={b.id} className="overflow-hidden rounded-2xl border border-border/70 bg-card">
              <img src={b.cover} alt="" className="aspect-[16/9] w-full object-cover" />
              <div className="p-4">
                <div className="font-display text-lg font-semibold">{b.kennel}</div>
                <div className="text-sm text-muted-foreground">
                  {b.city}, {b.country}
                </div>
                <div className="mt-4 flex gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link to="/@{$handle}" params={{ handle: b.slug }}>
                      {t("buyerPanel.followed.viewKennel")}
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={unfollowMutation.isPending}
                    onClick={() => unfollowMutation.mutate(b.id)}
                  >
                    {t("buyerPanel.followed.unfollow")}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
