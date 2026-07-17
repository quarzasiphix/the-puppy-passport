import { useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, Clock, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import {
  changeOpsRequestStatus,
  getOpsRequestDetail,
  listOpsStatusHistory,
} from "@/lib/queries/operations";
import { TransportDocumentChecklist } from "@/components/transport-document-checklist";
import { ChatThread } from "@/components/chat-thread";
import { startTransportConversation } from "@/lib/queries/messaging";

export const Route = createFileRoute("/dashboard/operations/requests/$id")({
  component: OpsRequestDetail,
});

const quickActions = [
  { status: "missing_information", label: "Request missing information" },
  { status: "documents_under_review", label: "Mark documents under review" },
  { status: "quotation_prepared", label: "Begin quotation" },
  { status: "compliance_hold", label: "Place on compliance hold" },
  { status: "veterinary_hold", label: "Place on veterinary hold" },
  { status: "ready_for_scheduling", label: "Mark ready for scheduling" },
  { status: "rejected", label: "Reject request" },
  { status: "cancelled_by_operations", label: "Cancel request" },
] as const;

function OpsRequestDetail() {
  const { id } = useParams({ from: "/dashboard/operations/requests/$id" });
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const [dialogStatus, setDialogStatus] = useState<string | null>(null);
  const [internalNote, setInternalNote] = useState("");
  const [customerNote, setCustomerNote] = useState("");

  const requestQuery = useQuery({
    queryKey: ["ops-request", id],
    queryFn: () => getOpsRequestDetail(id),
  });
  const historyQuery = useQuery({
    queryKey: ["ops-request-history", id],
    queryFn: () => listOpsStatusHistory(id),
  });

  const conversationQuery = useQuery({
    queryKey: ["transport-conversation", id],
    queryFn: () => startTransportConversation(id),
  });

  const mutation = useMutation({
    mutationFn: () =>
      changeOpsRequestStatus({
        id,
        newStatus: dialogStatus!,
        actorId: userId!,
        internalNote,
        customerNote,
      }),
    onSuccess: () => {
      toast.success("Status updated.");
      setDialogStatus(null);
      setInternalNote("");
      setCustomerNote("");
      queryClient.invalidateQueries({ queryKey: ["ops-request", id] });
      queryClient.invalidateQueries({ queryKey: ["ops-request-history", id] });
      queryClient.invalidateQueries({ queryKey: ["ops-requests"] });
      queryClient.invalidateQueries({ queryKey: ["ops-kpi-counts"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update status."),
  });

  if (requestQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (requestQuery.isError || !requestQuery.data)
    return <p className="text-sm text-destructive">Request not found.</p>;
  const r = requestQuery.data;

  return (
    <div>
      <Link
        to="/dashboard/operations/review-queue"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> All requests
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-medium">{r.request_number}</h1>
          <p className="text-sm text-muted-foreground">
            Submitted {new Date(r.created_at).toLocaleString("en-GB")}
          </p>
        </div>
        <Badge className="capitalize">{r.status.replace(/_/g, " ")}</Badge>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          <Card title="Animal">
            <Grid>
              <Field label="Name" value={r.animal_name} />
              <Field label="Breed" value={r.breed_free_text} />
              <Field label="Sex" value={r.sex} />
              <Field label="Size" value={r.size_category} />
              <Field label="Weight (kg)" value={r.weight_kg?.toString()} />
              <Field
                label="Microchip"
                value={r.microchip_known ? r.microchip_number || "known, not entered" : "unknown"}
              />
              <Field
                label="Passport"
                value={r.passport_available ? "Available" : "Not available"}
              />
              <Field label="Medically fit" value={r.medically_fit_for_transport ? "Yes" : "No"} />
            </Grid>
            {(r.behavioural_notes || r.anxiety_or_aggression_notes) && (
              <p className="mt-3 rounded-lg bg-secondary/50 p-3 text-xs text-muted-foreground">
                {r.behavioural_notes} {r.anxiety_or_aggression_notes}
              </p>
            )}
          </Card>

          <Card title="Route">
            <Grid>
              <Field label="Pickup" value={`${r.pickup_city ?? "?"}, ${r.pickup_country ?? "?"}`} />
              <Field
                label="Destination"
                value={`${r.destination_city ?? "?"}, ${r.destination_country ?? "?"}`}
              />
              <Field label="Earliest date" value={r.earliest_date} />
              <Field label="Latest date" value={r.latest_date} />
              <Field label="Flexible" value={r.flexible_dates ? "Yes" : "No"} />
              <Field label="Delivery type" value={r.delivery_type?.replace("_", " ")} />
            </Grid>
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-secondary/50 p-3 text-xs text-muted-foreground">
              <Lock className="size-3.5 shrink-0" />
              Exact addresses are only visible to assigned operations staff and drivers once a
              transport is accepted — not shown in this summary view.
            </div>
          </Card>

          <Card title="Compliance">
            <Grid>
              <Field label="Domestic" value={r.is_domestic ? "Yes" : "No"} />
              <Field label="Sale" value={r.is_sale ? "Yes" : "No"} />
              <Field label="Ownership change" value={r.is_ownership_change ? "Yes" : "No"} />
              <Field label="Rabies valid" value={r.rabies_valid ? "Yes" : "No"} />
              <Field
                label="Health certificate required"
                value={r.health_certificate_required ? "Yes" : "No"}
              />
              <Field label="Result" value={r.compliance_review_result?.replace(/_/g, " ")} />
            </Grid>
          </Card>

          <section className="rounded-2xl border border-border/70 bg-card p-5">
            <TransportDocumentChecklist transportRequestId={id} userId={userId!} canReview />
          </section>

          <Card title="Messages">
            <p className="mb-3 text-xs text-muted-foreground">
              Visible to the customer — for staff-only notes, use the internal note field on a
              status action instead.
            </p>
            {conversationQuery.data ? (
              <ChatThread conversationId={conversationQuery.data} currentUserId={userId!} />
            ) : (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Actions">
            <div className="grid gap-2">
              {quickActions.map((a) => (
                <Dialog
                  key={a.status}
                  open={dialogStatus === a.status}
                  onOpenChange={(open) => setDialogStatus(open ? a.status : null)}
                >
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="justify-start">
                      {a.label}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{a.label}</DialogTitle>
                      <DialogDescription>
                        This creates a status-history entry and an audit record.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Customer-facing note (optional)
                        </label>
                        <Textarea
                          rows={2}
                          value={customerNote}
                          onChange={(e) => setCustomerNote(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Internal note (never shown to the customer)
                        </label>
                        <Textarea
                          rows={2}
                          value={internalNote}
                          onChange={(e) => setInternalNote(e.target.value)}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setDialogStatus(null)}>
                        Cancel
                      </Button>
                      <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                        Confirm
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              ))}
            </div>
          </Card>

          <Card title="Status history">
            <ol className="space-y-3 border-l border-border/60 pl-4">
              {historyQuery.data?.map((h) => (
                <li key={h.id} className="relative">
                  <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-primary" />
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="size-3" /> {new Date(h.changed_at).toLocaleString("en-GB")}
                  </div>
                  <div className="text-sm font-medium capitalize">
                    {h.status.replace(/_/g, " ")}
                  </div>
                  {h.customer_note && (
                    <div className="text-xs text-muted-foreground">Customer: {h.customer_note}</div>
                  )}
                  {h.internal_note && (
                    <div className="text-xs text-muted-foreground">Internal: {h.internal_note}</div>
                  )}
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5">
      <h3 className="mb-3 font-display text-base font-semibold">{title}</h3>
      {children}
    </section>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return <dl className="grid grid-cols-2 gap-3 text-sm">{children}</dl>;
}
function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value || "—"}</dd>
    </div>
  );
}
