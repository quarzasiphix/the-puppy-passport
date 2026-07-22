import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { getMyKennel, listKennelLitters } from "@/lib/queries/breeder";
import { LitterFormDialog } from "@/components/litter-form-dialog";

export const Route = createFileRoute("/dashboard/breeder/litters/")({
  component: LittersPage,
});

function LittersPage() {
  const { userId } = useAuth();
  const { data: kennel } = useQuery({
    queryKey: ["my-kennel", userId],
    enabled: !!userId,
    queryFn: () => getMyKennel(userId!),
  });
  const { data: litters, isLoading } = useQuery({
    queryKey: ["kennel-litters", kennel?.id],
    enabled: !!kennel?.id,
    queryFn: () => listKennelLitters(kennel!.id),
  });

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-medium">Litters</h1>
          <p className="text-sm text-muted-foreground">Manage current and planned litters.</p>
        </div>
        {kennel?.id && (
          <div className="flex gap-2">
            <LitterFormDialog
              kennelId={kennel.id}
              defaultStatus="planned"
              trigger={<Button variant="outline">Add planned litter</Button>}
            />
            <LitterFormDialog
              kennelId={kennel.id}
              defaultStatus="born"
              trigger={
                <Button>
                  <Plus className="mr-1 size-4" /> Add litter
                </Button>
              }
            />
          </div>
        )}
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !litters?.length ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No litters yet. Add a planned litter to start tracking it, or add a litter once puppies
            are born.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-4">Litter</th>
                <th className="p-4">Breed</th>
                <th className="p-4">Parents</th>
                <th className="p-4">Born</th>
                <th className="p-4">Ready</th>
                <th className="p-4">Puppies</th>
                <th className="p-4">Status</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {litters.map((l) => (
                <tr key={l.id} className="hover:bg-secondary/40">
                  <td className="p-4 font-medium">{l.code}</td>
                  <td className="p-4">{l.breeds?.name ?? "—"}</td>
                  <td className="p-4 text-muted-foreground">
                    {l.mother?.registered_name ?? "?"} × {l.father?.registered_name ?? "?"}
                  </td>
                  <td className="p-4">
                    {l.birth_date ? new Date(l.birth_date).toLocaleDateString("en-GB") : "—"}
                  </td>
                  <td className="p-4">
                    {l.ready_date ? new Date(l.ready_date).toLocaleDateString("en-GB") : "—"}
                  </td>
                  <td className="p-4">
                    {l.totalPuppies}{" "}
                    <span className="text-xs text-muted-foreground">
                      ({l.availablePuppies} avail · {l.reservedPuppies} res)
                    </span>
                  </td>
                  <td className="p-4">
                    <Badge variant="secondary" className="capitalize">
                      {l.status.replace(/_/g, " ")}
                    </Badge>
                    {!l.is_published && (
                      <Badge variant="outline" className="ml-1">
                        Draft
                      </Badge>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <Link
                      to="/dashboard/breeder/litters/$id"
                      params={{ id: l.id }}
                      className="text-primary hover:underline"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
