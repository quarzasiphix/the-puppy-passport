import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  getMyKennel,
  listKennelLitters,
  listKennelPuppies,
  updatePuppy,
} from "@/lib/queries/breeder";
import { PuppyFormDialog } from "@/components/puppy-form-dialog";

export const Route = createFileRoute("/dashboard/breeder/puppies")({
  component: PuppiesPage,
});

function PuppiesPage() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  const { data: kennel } = useQuery({
    queryKey: ["my-kennel", userId],
    enabled: !!userId,
    queryFn: () => getMyKennel(userId!),
  });
  const { data: puppies, isLoading } = useQuery({
    queryKey: ["kennel-puppies", kennel?.id],
    enabled: !!kennel?.id,
    queryFn: () => listKennelPuppies(kennel!.id),
  });
  const { data: litters } = useQuery({
    queryKey: ["kennel-litters", kennel?.id],
    enabled: !!kennel?.id,
    queryFn: () => listKennelLitters(kennel!.id),
  });

  const publishMutation = useMutation({
    mutationFn: ({ id, isPublished }: { id: string; isPublished: boolean }) =>
      updatePuppy(id, {
        is_published: isPublished,
        availability_status: isPublished ? "available" : "draft",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kennel-puppies"] });
      toast.success("Updated.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update puppy."),
  });

  const reserveMutation = useMutation({
    mutationFn: (id: string) => updatePuppy(id, { availability_status: "reserved" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kennel-puppies"] });
      toast.success("Marked reserved.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update puppy."),
  });

  const litterOptions = (litters ?? []).map((l) => ({ id: l.id, code: l.code }));

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-medium">Puppies</h1>
          <p className="text-sm text-muted-foreground">Manage individual puppy listings.</p>
        </div>
        {kennel?.id &&
          (litterOptions.length ? (
            <PuppyFormDialog
              kennelId={kennel.id}
              litterOptions={litterOptions}
              trigger={<Button>Add puppy</Button>}
            />
          ) : (
            <Button asChild variant="outline">
              <Link to="/dashboard/breeder/litters">Add a litter first</Link>
            </Button>
          ))}
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !puppies?.length ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {litterOptions.length
              ? "No puppies yet. Add your first one above."
              : "No puppies yet — a litter comes first (parents, breed, birth date), then puppies."}
          </p>
          {!litterOptions.length && (
            <Button asChild className="mt-4" size="sm">
              <Link to="/dashboard/breeder/litters">Add a litter</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {puppies.map((p) => (
            <article
              key={p.id}
              className="overflow-hidden rounded-2xl border border-border/70 bg-card"
            >
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-display text-lg font-semibold">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.breeds?.name ?? "Breed not set"} · {p.sex ?? "sex not set"}
                      {p.litters?.code && ` · ${p.litters.code}`}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="secondary" className="capitalize">
                      {p.availability_status.replace(/_/g, " ")}
                    </Badge>
                    {!p.is_published && (
                      <Badge variant="outline" className="text-xs">
                        Draft
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <PuppyFormDialog
                    kennelId={kennel!.id}
                    puppy={p}
                    trigger={
                      <Button size="sm" variant="outline">
                        Edit
                      </Button>
                    }
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={publishMutation.isPending}
                    onClick={() =>
                      publishMutation.mutate({ id: p.id, isPublished: !p.is_published })
                    }
                  >
                    {p.is_published ? "Unpublish" : "Publish"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled
                    title="Applications review is coming in a later update"
                  >
                    Applications
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={reserveMutation.isPending || p.availability_status === "reserved"}
                    onClick={() => reserveMutation.mutate(p.id)}
                  >
                    Mark reserved
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
