import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertOctagon, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { incidentTypeLabels } from "@/lib/queries/driver";

export const Route = createFileRoute("/dashboard/operations/incidents")({
  component: IncidentsPage,
});

type IncidentRow = {
  id: string;
  transport_request_id: string;
  incident_type: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  status: "open" | "investigating" | "resolved";
  occurred_at: string;
  profiles: { display_name: string | null } | null;
  transport_requests: { request_number: string } | null;
};

async function listIncidents() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("transport_incidents")
    .select(
      "id, transport_request_id, incident_type, severity, description, status, occurred_at, profiles!transport_incidents_reported_by_fkey(display_name), transport_requests(request_number)",
    )
    .order("occurred_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as IncidentRow[];
}

const severityStyles: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-accent/15 text-accent",
  high: "bg-warning/20 text-foreground",
  critical: "bg-destructive/15 text-destructive",
};

function IncidentsPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["ops-incidents"], queryFn: listIncidents });

  const resolveMutation = useMutation({
    mutationFn: async (id: string) => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("transport_incidents")
        .update({ status: "resolved", resolved_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marked resolved.");
      queryClient.invalidateQueries({ queryKey: ["ops-incidents"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update."),
  });

  const investigateMutation = useMutation({
    mutationFn: async (id: string) => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("transport_incidents")
        .update({ status: "investigating" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ops-incidents"] }),
  });

  const open = (query.data ?? []).filter((i) => i.status !== "resolved");
  const resolved = (query.data ?? []).filter((i) => i.status === "resolved");

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">Incidents</h1>
        <p className="text-sm text-muted-foreground">
          Operational incidents reported by drivers during transport.
        </p>
      </header>

      <section className="mb-8">
        <h2 className="mb-3 font-display text-lg font-semibold">Open ({open.length})</h2>
        {query.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : open.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-6 text-center">
            <AlertOctagon className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">No open incidents.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {open.map((i) => (
              <div key={i.id} className="rounded-2xl border border-border/70 bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge className={severityStyles[i.severity]}>{i.severity}</Badge>
                      <span className="font-medium">
                        {incidentTypeLabels[i.incident_type] ?? i.incident_type}
                      </span>
                      {i.transport_requests?.request_number && (
                        <Link
                          to="/dashboard/operations/requests/$id"
                          params={{ id: i.transport_request_id }}
                          className="text-sm text-primary hover:underline"
                        >
                          {i.transport_requests.request_number}
                        </Link>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Reported by {i.profiles?.display_name ?? "Unknown"} ·{" "}
                      {new Date(i.occurred_at).toLocaleString("en-GB")}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{i.description}</p>
                  </div>
                  <Badge variant="secondary" className="capitalize">
                    {i.status}
                  </Badge>
                </div>
                <div className="mt-4 flex gap-2">
                  {i.status === "open" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => investigateMutation.mutate(i.id)}
                    >
                      Start investigating
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => resolveMutation.mutate(i.id)}
                    disabled={resolveMutation.isPending}
                  >
                    <CheckCircle2 className="mr-1 size-4" /> Mark resolved
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {resolved.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold">Resolved ({resolved.length})</h2>
          <div className="space-y-2">
            {resolved.map((i) => (
              <div
                key={i.id}
                className="flex items-center justify-between rounded-xl border border-border/60 bg-card px-4 py-3 text-sm"
              >
                <span>
                  {incidentTypeLabels[i.incident_type] ?? i.incident_type} —{" "}
                  {i.transport_requests?.request_number ?? "?"}
                </span>
                <Badge className={severityStyles[i.severity]}>{i.severity}</Badge>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
