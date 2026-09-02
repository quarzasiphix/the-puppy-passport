import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { useAuth } from "@/domains/identity";
import { getMyKennel, listKennelAchievements } from "@/domains/breeders";

export const Route = createFileRoute("/dashboard/breeder/champions")({
  component: ChampionsPage,
});

function ChampionsPage() {
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

  const verified = (achievements ?? []).filter((a) => a.verification_status === "approved");
  const byDog = new Map<string, { name: string; titles: string[] }>();
  for (const a of verified) {
    const name = a.parent_dogs?.registered_name ?? "Unknown dog";
    const entry = byDog.get(a.parent_dog_id) ?? { name, titles: [] };
    entry.titles.push(a.title);
    byDog.set(a.parent_dog_id, entry);
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">Champion dogs</h1>
        <p className="text-sm text-muted-foreground">
          A preview of what shows on your public kennel page's "Champions" section — only
          admin-verified achievements appear here.{" "}
          {kennel?.slug && (
            <Link
              to="/breeders/$slug"
              params={{ slug: kennel.slug }}
              className="text-primary hover:underline"
            >
              View public page
            </Link>
          )}
        </p>
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : byDog.size === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-8 text-center">
          <Trophy className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            No verified achievements yet. Add and submit one from the Achievements page — once an
            admin verifies it, your dog appears here and publicly.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from(byDog.values()).map((dog) => (
            <div key={dog.name} className="rounded-2xl border border-border/70 bg-card p-5">
              <div className="flex items-center gap-2">
                <Trophy className="size-4 text-accent" />
                <div className="font-display text-lg font-semibold">{dog.name}</div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {dog.titles.map((t) => (
                  <Badge key={t} variant="secondary">
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
