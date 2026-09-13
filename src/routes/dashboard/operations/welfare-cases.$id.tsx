import { useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";
import {
  acknowledgeWelfareCase,
  convertWelfareCaseToTransportDraft,
  getSignedWelfareDocumentUrl,
  getWelfareCase,
  listWelfareCaseDocuments,
  reviewWelfareCase,
  welfareCaseStatusLabels,
} from "@/domains/transport";

export const Route = createFileRoute("/dashboard/operations/welfare-cases/$id")({
  component: OpsWelfareCaseDetail,
});

const urgencyStyles: Record<string, string> = {
  routine: "bg-muted text-muted-foreground",
  urgent: "bg-warning/20 text-foreground",
  critical: "bg-destructive/10 text-destructive",
};

function OpsWelfareCaseDetail() {
  const { id } = useParams({ from: "/dashboard/operations/welfare-cases/$id" });
  const queryClient = useQueryClient();
  const posthog = usePostHog();
  const [reviewNotes, setReviewNotes] = useState("");

  const caseQuery = useQuery({ queryKey: ["welfare-case", id], queryFn: () => getWelfareCase(id) });
  const documentsQuery = useQuery({
    queryKey: ["welfare-case-documents", id],
    queryFn: () => listWelfareCaseDocuments(id),
  });

  const acknowledgeMutation = useMutation({
    mutationFn: () => acknowledgeWelfareCase(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["welfare-case", id] }),
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not acknowledge."),
  });

  const reviewMutation = useMutation({
    mutationFn: (decision: "accepted_for_assessment" | "declined" | "information_required") =>
      reviewWelfareCase({ caseId: id, decision, reviewNotes }),
    onSuccess: (_data, decision) => {
      posthog.capture("welfare_case_reviewed", { decision });
      toast.success("Case reviewed.");
      queryClient.invalidateQueries({ queryKey: ["welfare-case", id] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not review."),
  });

  const convertMutation = useMutation({
    mutationFn: () => convertWelfareCaseToTransportDraft(id),
    onSuccess: (requestId) => {
      toast.success("Converted to a transport draft.");
      queryClient.invalidateQueries({ queryKey: ["welfare-case", id] });
      queryClient.invalidateQueries({ queryKey: ["ops-welfare-cases"] });
      void requestId;
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not convert."),
  });

  const openDocument = async (path: string) => {
    try {
      const url = await getSignedWelfareDocumentUrl(path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open document.");
    }
  };

  if (caseQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!caseQuery.data) return <p className="text-sm text-destructive">Case not found.</p>;
  const c = caseQuery.data;

  return (
    <div>
      <Link
        to="/dashboard/operations/welfare-cases"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> All welfare cases
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-medium">{c.animal_name || c.case_number}</h1>
            <Badge className={urgencyStyles[c.urgency]}>{c.urgency}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {c.organisations?.name ?? "Unknown organisation"} · {c.reason}
          </p>
        </div>
        <Badge variant="secondary">{welfareCaseStatusLabels[c.status]}</Badge>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-border/70 bg-card p-5">
          <h3 className="mb-3 font-display text-base font-semibold">Case details</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Animal</dt>
              <dd className="text-right">{c.animal_name ?? "Not named"}</dd>
            </div>
            {c.animal_description && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Description</dt>
                <dd className="text-right">{c.animal_description}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">From</dt>
              <dd className="text-right">
                {c.location_city ?? c.location_country ?? "?"}
                {c.location_area_approx && ` (${c.location_area_approx})`}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">To</dt>
              <dd className="text-right">{c.destination_city ?? c.destination_country ?? "?"}</dd>
            </div>
            {c.deadline && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Deadline</dt>
                <dd className="text-right">{new Date(c.deadline).toLocaleDateString("en-GB")}</dd>
              </div>
            )}
            {c.contact_name && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Contact</dt>
                <dd className="text-right">
                  {c.contact_name} {c.contact_phone && `· ${c.contact_phone}`}
                </dd>
              </div>
            )}
            {c.welfare_notes && (
              <div>
                <dt className="text-muted-foreground">Welfare notes</dt>
                <dd className="mt-1 whitespace-pre-wrap">{c.welfare_notes}</dd>
              </div>
            )}
          </dl>
        </section>

        <section className="rounded-2xl border border-border/70 bg-card p-5">
          <h3 className="mb-3 font-display text-base font-semibold">Documents</h3>
          {!documentsQuery.data?.length ? (
            <p className="text-sm text-muted-foreground">No documents uploaded.</p>
          ) : (
            <ul className="space-y-2">
              {documentsQuery.data.map((d) => (
                <li key={d.id} className="flex items-center justify-between text-sm">
                  <button
                    onClick={() => openDocument(d.file_url)}
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    {d.notes || "Document"} <ExternalLink className="size-3.5" />
                  </button>
                  <span className="text-xs text-muted-foreground">
                    {new Date(d.created_at).toLocaleDateString("en-GB")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-border/70 bg-card p-5">
        <h3 className="mb-3 font-display text-base font-semibold">Review</h3>

        {!c.ops_acknowledged && (
          <div className="mb-4">
            <Button
              size="sm"
              variant="outline"
              disabled={acknowledgeMutation.isPending}
              onClick={() => acknowledgeMutation.mutate()}
            >
              Acknowledge
            </Button>
          </div>
        )}

        {(c.status === "submitted" ||
          c.status === "under_review" ||
          c.status === "information_required") && (
          <div className="space-y-2">
            <Textarea
              rows={3}
              placeholder="Internal review notes (never shown to the organisation)"
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={reviewMutation.isPending}
                onClick={() => reviewMutation.mutate("accepted_for_assessment")}
              >
                Accept for assessment
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={reviewMutation.isPending}
                onClick={() => reviewMutation.mutate("information_required")}
              >
                Request more information
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={reviewMutation.isPending}
                onClick={() => reviewMutation.mutate("declined")}
              >
                Decline
              </Button>
            </div>
          </div>
        )}

        {c.status === "accepted_for_assessment" && (
          <div>
            <p className="mb-2 text-sm text-muted-foreground">
              Accepted for assessment. Convert this into a transport request once ready to schedule.
            </p>
            <Button
              size="sm"
              disabled={convertMutation.isPending}
              onClick={() => convertMutation.mutate()}
            >
              Convert to transport draft
            </Button>
          </div>
        )}

        {(c.status === "declined" ||
          c.status === "converted_to_transport" ||
          c.status === "closed") && (
          <p className="text-sm text-muted-foreground">
            This case is {welfareCaseStatusLabels[c.status].toLowerCase()} — no further action
            needed here.
          </p>
        )}
      </section>
    </div>
  );
}
