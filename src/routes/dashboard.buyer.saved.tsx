import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { listSavedAnimals } from "@/lib/queries/buyer-activity";
import { EmptyState } from "@/components/public/empty-state";
import { ErrorState } from "@/components/public/error-state";
import { AnimalImage } from "@/components/marketplace/animal-image";

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
  const rehoming = saved.flatMap((s) => (s.kind === "private_rehoming" ? [s.adoption] : []));

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">Saved animals</h1>
        <p className="text-sm text-muted-foreground">Puppies and dogs you're keeping an eye on.</p>
      </header>
      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : query.isError ? (
        <ErrorState
          compact
          title="Couldn't load your saved animals. Please try again."
          action={
            <Button variant="outline" size="sm" onClick={() => query.refetch()}>
              Try again
            </Button>
          }
        />
      ) : saved.length === 0 ? (
        <EmptyState
          title="Nothing saved yet"
          description="Tap the heart on any listing to save it here."
          action={
            <>
              <Link to="/find-a-dog" className="text-sm text-primary hover:underline">
                Browse available puppies
              </Link>
              <Link to="/adoptions" className="text-sm text-primary hover:underline">
                Browse dogs for adoption
              </Link>
            </>
          }
        />
      ) : (
        <div className="space-y-8">
          {puppies.length > 0 && (
            <SavedSection title="Puppies">
              {puppies.map((p) => (
                <AnimalTile
                  key={p.id}
                  to="/puppies/$id"
                  id={p.id}
                  image={p.image}
                  name={p.name}
                  secondaryLine={`${p.breed} · ${p.kennel}`}
                />
              ))}
            </SavedSection>
          )}
          {adoptions.length > 0 && (
            <SavedSection title="Dogs for adoption">
              {adoptions.map((a) => (
                <AnimalTile
                  key={a.id}
                  to="/adoptions/$id"
                  id={a.id}
                  image={a.image}
                  name={a.name}
                  secondaryLine={`${a.breed} · ${a.orgName}`}
                />
              ))}
            </SavedSection>
          )}
          {rehoming.length > 0 && (
            <SavedSection title="Private rehoming">
              {rehoming.map((a) => (
                <AnimalTile
                  key={a.id}
                  to="/adoptions/$id"
                  id={a.id}
                  image={a.image}
                  name={a.name}
                  secondaryLine={`${a.breed} · ${a.orgName}`}
                />
              ))}
            </SavedSection>
          )}
        </div>
      )}
    </div>
  );
}

function SavedSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

function AnimalTile({
  to,
  id,
  image,
  name,
  secondaryLine,
}: {
  to: "/puppies/$id" | "/adoptions/$id";
  id: string;
  image: string;
  name: string;
  secondaryLine: string;
}) {
  return (
    <Link
      to={to}
      params={{ id }}
      className="overflow-hidden rounded-2xl border border-border/70 bg-card transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <AnimalImage src={image} alt="" className="aspect-[4/3] w-full object-cover" />
      <div className="p-4">
        <div className="font-display text-lg font-semibold">{name}</div>
        <div className="break-words text-sm text-muted-foreground">{secondaryLine}</div>
      </div>
    </Link>
  );
}
