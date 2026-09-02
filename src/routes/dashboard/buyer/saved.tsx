import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/domains/identity";
import { listSavedPuppies } from "@/domains/marketplace";

export const Route = createFileRoute("/dashboard/buyer/saved")({
  component: SavedPuppies,
});

function SavedPuppies() {
  const { userId } = useAuth();
  const query = useQuery({
    queryKey: ["my-saved-puppies", userId],
    enabled: !!userId,
    queryFn: () => listSavedPuppies(userId!),
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">Saved puppies</h1>
        <p className="text-sm text-muted-foreground">Puppies you're keeping an eye on.</p>
      </header>
      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !query.data?.length ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-10 text-center">
          <p className="font-medium">No saved puppies yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tap the heart on any listing to save it here.
          </p>
          <Link to="/find-a-dog" className="mt-3 inline-block text-sm text-primary hover:underline">
            Browse available puppies
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
