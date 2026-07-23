import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { listSavedAnimals } from "@/lib/queries/buyer-activity";

export const Route = createFileRoute("/dashboard/buyer/saved")({
  component: SavedAnimals,
});

function SavedAnimals() {
  const { userId } = useAuth();
  const query = useQuery({
    queryKey: ["my-saved-animals", userId],
    enabled: !!userId,
    queryFn: () => listSavedAnimals(userId!),
  });

  const saved = query.data ?? [];
  const puppies = saved.flatMap((s) => (s.kind === "puppy" ? [s.puppy] : []));
  const adoptions = saved.flatMap((s) => (s.kind === "adoption" ? [s.adoption] : []));

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">Saved animals</h1>
        <p className="text-sm text-muted-foreground">Puppies and dogs you're keeping an eye on.</p>
      </header>
      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : saved.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-10 text-center">
          <p className="font-medium">Nothing saved yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tap the heart on any listing to save it here.
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1">
            <Link to="/find-a-dog" className="text-sm text-primary hover:underline">
              Browse available puppies
            </Link>
            <Link to="/adoptions" className="text-sm text-primary hover:underline">
              Browse dogs for adoption
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {puppies.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Puppies
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {puppies.map((p) => (
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
            </section>
          )}
          {adoptions.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Dogs for adoption
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {adoptions.map((a) => (
                  <Link
                    key={a.id}
                    to="/adoptions/$id"
                    params={{ id: a.id }}
                    className="overflow-hidden rounded-2xl border border-border/70 bg-card transition-colors hover:bg-secondary/40"
                  >
                    <img src={a.image} alt="" className="aspect-[4/3] w-full object-cover" />
                    <div className="p-4">
                      <div className="font-display text-lg font-semibold">{a.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {a.breed} · {a.orgName}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
