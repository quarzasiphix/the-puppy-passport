import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { listAllOrganisationsForAdmin, setOrganisationFeatured, useAuth } from "@/domains/identity";
import { setOrganisationSuspended } from "@/domains/trust";

const statusStyles: Record<string, string> = {
  pending: "bg-accent/15 text-accent",
  approved: "bg-success/15 text-success",
  rejected: "bg-destructive/10 text-destructive",
  suspended: "bg-destructive/10 text-destructive",
};

/** Shared by /dashboard/admin/organisations and /dashboard/moderator/organisations. Suspend/
 * restore goes through moderator_set_organisation_suspended() (is_moderator()-gated RPC) so it
 * works for both roles — the only thing gated to admin specifically is "Featured", a marketing
 * placement decision rather than a trust/moderation one. */
export function OrganisationsPanel() {
  const { roles } = useAuth();
  const isAdmin = roles.some((r) => r.role === "admin" && r.status === "active");
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState("all");
  const query = useQuery({
    queryKey: ["admin-organisations"],
    queryFn: listAllOrganisationsForAdmin,
  });

  const statusMutation = useMutation({
    mutationFn: (input: { id: string; suspend: boolean }) =>
      setOrganisationSuspended(input.id, input.suspend),
    onSuccess: () => {
      toast.success("Organisation updated.");
      queryClient.invalidateQueries({ queryKey: ["admin-organisations"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update."),
  });

  const featuredMutation = useMutation({
    mutationFn: (input: { id: string; featured: boolean }) =>
      setOrganisationFeatured(input.id, input.featured),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-organisations"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update."),
  });

  const filtered = query.data?.filter((o) => typeFilter === "all" || o.org_type === typeFilter);

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium">Organisations</h1>
          <p className="text-sm text-muted-foreground">
            Every kennel, foundation, shelter and rescue on the platform — check details and
            suspend or restore any of them.
          </p>
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="kennel">Kennel</SelectItem>
            <SelectItem value="foundation">Foundation</SelectItem>
            <SelectItem value="shelter">Shelter</SelectItem>
            <SelectItem value="rescue">Rescue</SelectItem>
            <SelectItem value="transport_company">Transport company</SelectItem>
            <SelectItem value="kennel_club">Kennel club</SelectItem>
          </SelectContent>
        </Select>
      </header>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-4">Name</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Location</th>
                  <th className="p-4">Status</th>
                  {isAdmin && <th className="p-4">Featured</th>}
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filtered?.map((o) => (
                  <tr key={o.id} className="hover:bg-secondary/40">
                    <td className="p-4 font-medium">{o.name}</td>
                    <td className="p-4 capitalize text-muted-foreground">
                      {o.org_type.replace(/_/g, " ")}
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {o.city}, {o.country}
                    </td>
                    <td className="p-4">
                      <Badge className={statusStyles[o.verification_status]}>
                        {o.verification_status}
                      </Badge>
                    </td>
                    {isAdmin && (
                      <td className="p-4">
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={featuredMutation.isPending}
                          onClick={() =>
                            featuredMutation.mutate({ id: o.id, featured: !o.is_featured })
                          }
                        >
                          <Star
                            className={`size-4 ${o.is_featured ? "fill-warning text-warning" : "text-muted-foreground"}`}
                          />
                        </Button>
                      </td>
                    )}
                    <td className="p-4 text-right">
                      {o.verification_status === "suspended" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={statusMutation.isPending}
                          onClick={() => statusMutation.mutate({ id: o.id, suspend: false })}
                        >
                          Restore
                        </Button>
                      ) : o.verification_status === "approved" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={statusMutation.isPending}
                          onClick={() => statusMutation.mutate({ id: o.id, suspend: true })}
                        >
                          Suspend
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
