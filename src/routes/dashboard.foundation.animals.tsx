import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  getMyFoundation,
  listFoundationAnimals,
  updateAdoptionAnimal,
} from "@/lib/queries/foundation";
import { AdoptionFormDialog } from "@/components/adoption-form-dialog";

export const Route = createFileRoute("/dashboard/foundation/animals")({
  component: AnimalsPage,
});

function AnimalsPage() {
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
      toast.success("Updated.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update."),
  });

  const adoptedMutation = useMutation({
    mutationFn: (id: string) => updateAdoptionAnimal(id, { availability_status: "adopted" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["foundation-animals"] });
      toast.success("Marked as adopted.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update."),
  });

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-medium">Animals</h1>
          <p className="text-sm text-muted-foreground">
            Manage animals available for adoption — publish, update status, and connect them to
            transport once collected.
          </p>
        </div>
        {org?.id && <AdoptionFormDialog orgId={org.id} trigger={<Button>Add animal</Button>} />}
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !animals?.length ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No animals yet. Add one to start the adoption process.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                      {a.breeds?.name ?? "Mixed breed"} · {a.sex ?? "sex not set"}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="secondary" className="capitalize">
                      {a.availability_status.replace(/_/g, " ")}
                    </Badge>
                    {!a.is_published && (
                      <Badge variant="outline" className="text-xs">
                        Draft
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
                        Edit
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
                    {a.is_published ? "Unpublish" : "Publish"}
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
                    disabled={adoptedMutation.isPending || a.availability_status === "adopted"}
                    onClick={() => adoptedMutation.mutate(a.id)}
                  >
                    Mark adopted
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
