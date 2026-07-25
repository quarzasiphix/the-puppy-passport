import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listOpsTransportRequests } from "@/lib/queries/operations";
import type { TransportStatus, TransportServiceType } from "@/lib/supabase/enums";

const statusOptions = [
  "submitted",
  "initial_review",
  "missing_information",
  "documents_under_review",
  "quotation_prepared",
  "quotation_sent",
  "accepted_by_customer",
  "awaiting_documents",
  "ready_for_scheduling",
  "scheduled",
  "driver_assigned",
  "pickup_confirmed",
  "animal_collected",
  "in_transport",
  "rest_or_care_stop",
  "approaching_destination",
  "delivered",
  "handover_confirmed",
  "completed",
  "rejected",
  "cancelled_by_customer",
  "cancelled_by_operations",
  "veterinary_hold",
  "compliance_hold",
  "route_postponed",
];

const holdOrProblemStatuses = new Set([
  "missing_information",
  "veterinary_hold",
  "compliance_hold",
  "rejected",
]);

// Shared by "New requests" (fixedStatuses set, no filter UI), "Review queue" (full filterable
// table) and "Compliance holds" / "Active transports" (each with their own fixed status set) —
// same dense operational row shape everywhere.
export function OpsRequestTable({
  fixedStatuses,
  showFilters = false,
}: {
  fixedStatuses?: string[];
  showFilters?: boolean;
}) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");

  const query = useQuery({
    queryKey: ["ops-requests", fixedStatuses, statusFilter, serviceFilter],
    queryFn: () =>
      listOpsTransportRequests({
        // These come from a live dropdown backed by real enum-valued option lists (a status the
        // page was given via fixedStatuses, or an option literally rendered from the same status
        // set) -- TS can't statically prove a runtime string equals one of the literal union
        // members, but the actual values populating these controls always do.
        status: (fixedStatuses?.length === 1
          ? fixedStatuses[0]
          : statusFilter === "all"
            ? undefined
            : statusFilter) as TransportStatus | undefined,
        serviceType: (serviceFilter === "all" ? undefined : serviceFilter) as
          TransportServiceType | undefined,
      }),
  });

  const rows = (query.data ?? []).filter((r) => !fixedStatuses || fixedStatuses.includes(r.status));

  return (
    <div>
      {showFilters && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[220px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {statusOptions.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={serviceFilter} onValueChange={setServiceFilter}>
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue placeholder="Service" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All services</SelectItem>
              <SelectItem value="shared">Shared</SelectItem>
              <SelectItem value="individual">Individual</SelectItem>
              <SelectItem value="express">Express</SelectItem>
              <SelectItem value="vip">VIP</SelectItem>
              <SelectItem value="recommend_best">Recommend best</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {query.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {query.isError && <p className="text-sm text-destructive">Could not load requests.</p>}
      {!query.isLoading && rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-border/70 bg-secondary/40 p-8 text-center text-sm text-muted-foreground">
          Nothing here right now.
        </div>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border/70 bg-card">
          <table className="w-full text-xs">
            <thead className="bg-secondary/60 text-left uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="p-3">Request</th>
                <th className="p-3">Animal</th>
                <th className="p-3">Size</th>
                <th className="p-3">Route</th>
                <th className="p-3">Dates</th>
                <th className="p-3">Flex</th>
                <th className="p-3">Service</th>
                <th className="p-3">Compliance</th>
                <th className="p-3">Status</th>
                <th className="p-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-secondary/40">
                  <td className="p-3 font-medium">
                    <Link
                      to="/dashboard/operations/requests/$id"
                      params={{ id: r.id }}
                      className="text-primary hover:underline"
                    >
                      {r.request_number}
                    </Link>
                  </td>
                  <td className="p-3">{r.animal_name ?? "—"}</td>
                  <td className="p-3 capitalize">{r.size_category ?? "—"}</td>
                  <td className="p-3 text-muted-foreground">
                    {r.pickup_city ?? r.pickup_country ?? "?"} →{" "}
                    {r.destination_city ?? r.destination_country ?? "?"}
                  </td>
                  <td className="p-3 text-muted-foreground">{r.earliest_date ?? "—"}</td>
                  <td className="p-3">{r.flexible_dates ? "Yes" : "No"}</td>
                  <td className="p-3 capitalize">{r.requested_service_type.replace("_", " ")}</td>
                  <td className="p-3">
                    <Badge variant="secondary" className="whitespace-nowrap capitalize">
                      {r.compliance_review_result.replace(/_/g, " ")}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <Badge
                      variant={holdOrProblemStatuses.has(r.status) ? "destructive" : "secondary"}
                      className="whitespace-nowrap capitalize"
                    >
                      {r.status.replace(/_/g, " ")}
                    </Badge>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("en-GB")}
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
