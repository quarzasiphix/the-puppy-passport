import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/domains/identity";
import { listSavedPuppies } from "@/domains/marketplace";
import { useTranslation } from "@/shared/i18n";

export const Route = createFileRoute("/dashboard/buyer/saved")({
  component: SavedPuppies,
});

function SavedPuppies() {
  const { t } = useTranslation();
  const { userId } = useAuth();
  const query = useQuery({
    queryKey: ["my-saved-puppies", userId],
    enabled: !!userId,
    queryFn: () => listSavedPuppies(userId!),
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">{t("buyerPanel.saved.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("buyerPanel.saved.subtitle")}</p>
      </header>
      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("buyerPanel.saved.loading")}</p>
      ) : !query.data?.length ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-10 text-center">
          <p className="font-medium">{t("buyerPanel.saved.emptyTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("buyerPanel.saved.emptyBody")}</p>
          <Link to="/find-a-dog" className="mt-3 inline-block text-sm text-primary hover:underline">
            {t("buyerPanel.saved.browsePuppies")}
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {query.data.map((p) => (
            <Link
              key={p.id}
              to="/puppies/$id"
              params={{ id: p.id }}
              className="overflow-hidden rounded-2xl border border-border/70 bg-card transition-colors hover:bg-secondary/40"
            >
              <img src={p.image} alt="" className="aspect-[4/3] w-full object-cover" />
              <div className="p-4">
                <div className="font-display text-lg font-semibold">{p.name}</div>
                <div className="text-sm text-muted-foreground">
                  {p.breed} · {p.kennel}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
