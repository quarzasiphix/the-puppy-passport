import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import {
  acknowledgeWelfareCase,
  listOpsWelfareCases,
  welfareCaseStatusLabels,
} from "@/domains/transport";

export const Route = createFileRoute("/dashboard/operations/welfare-cases")({
  component: OpsWelfareCasesPage,
});

const urgencyStyles: Record<string, string> = {
  routine: "bg-muted text-muted-foreground",
  urgent: "bg-warning/20 text-foreground",
  critical: "bg-destructive/10 text-destructive",
};

function OpsWelfareCasesPage() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const casesQuery = useQuery({ queryKey: ["ops-welfare-cases"], queryFn: listOpsWelfareCases });

  const acknowledgeMutation = useMutation({
    mutationFn: (caseId: string) => acknowledgeWelfareCase(caseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ops-welfare-cases"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not acknowledge."),
  });

  const bulkAcknowledgeMutation = useMutation({
    mutationFn: async () => {
      await Promise.all([...selected].map((id) => acknowledgeWelfareCase(id)));
    },
    onSuccess: () => {
      toast.success(`${selected.size} case${selected.size === 1 ? "" : "s"} acknowledged.`);
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["ops-welfare-cases"] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not acknowledge all selected cases."),
  });

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-2xl font-medium">Welfare cases</h1>
        <p className="text-sm text-muted-foreground">
          Urgent welfare/rescue cases reported by verified foundations, shelters and rescues.
          Urgency alone never grants transport priority, bypasses review, or confirms capacity —
          every case still goes through acknowledgement and assessment here.
        </p>
      </header>

      {selected.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Button
            size="sm"
            disabled={bulkAcknowledgeMutation.isPending}
            onClick={() => bulkAcknowledgeMutation.mutate()}
          >
            Acknowledge selected
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {casesQuery.data?.map((c) => (
          <div
            key={c.id}
            className="rounded-2xl border border-border/70 bg-card p-5 transition-colors hover:border-primary/40"
          >
            <Link
              to="/dashboard/operations/welfare-cases/$id"
              params={{ id: c.id }}
              className="flex flex-wrap items-start justify-between gap-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-lg font-semibold">
                    {c.animal_name || c.case_number}
                  </span>
                  <Badge className={urgencyStyles[c.urgency]}>
                    {c.urgency === "critical" && <AlertTriangle className="mr-1 size-3" />}
                    {c.urgency}
                  </Badge>
                  {!c.ops_acknowledged && <Badge variant="outline">Not yet acknowledged</Badge>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {c.organisations?.name ?? "Unknown organisation"} · {c.reason}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {c.location_city ?? c.location_country ?? "?"} →{" "}
                  {c.destination_city ?? c.destination_country ?? "?"}
                  {c.deadline && ` · Deadline ${new Date(c.deadline).toLocaleDateString("en-GB")}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{welfareCaseStatusLabels[c.status]}</Badge>
                <ChevronRight className="size-4 text-muted-foreground" />
              </div>
            </Link>

            {!c.ops_acknowledged && (
              <div className="mt-3 flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} />
                  Select
                </label>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={acknowledgeMutation.isPending}
                  onClick={() => acknowledgeMutation.mutate(c.id)}
                >
                  Acknowledge
                </Button>
              </div>
            )}
          </div>
        ))}
        {casesQuery.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">No welfare cases reported yet.</p>
        )}
      </div>
    </div>
  );
}
