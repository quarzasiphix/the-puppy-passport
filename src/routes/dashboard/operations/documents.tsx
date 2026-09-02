import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, ExternalLink, FileText, XCircle } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { useAuth } from "@/domains/identity";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { documentCategoryLabels, documentExpiryWarning, reviewDocument } from "@/domains/transport";

export const Route = createFileRoute("/dashboard/operations/documents")({
  component: DocumentsPage,
});

type OpsDocumentRow = {
  id: string;
  category: string;
  file_url: string | null;
  status: string;
  expiry_date: string | null;
  created_at: string;
  transport_request_id: string;
  transport_requests: { request_number: string } | null;
};

async function listAllDocuments() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("transport_documents")
    .select(
      "id, category, file_url, status, expiry_date, created_at, transport_request_id, transport_requests(request_number)",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as OpsDocumentRow[];
}

function DocumentsPage() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["ops-all-documents"], queryFn: listAllDocuments });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "accepted" | "rejected" }) =>
      reviewDocument(id, status, userId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ops-all-documents"] });
      toast.success("Updated.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update."),
  });

  const docs = query.data ?? [];
  const needsReview = docs.filter((d) => d.status === "uploaded");
  const expiring = docs.filter(
    (d) => d.status === "accepted" && documentExpiryWarning(d.expiry_date) != null,
  );

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">Documents</h1>
        <p className="text-sm text-muted-foreground">
          Document review queue across all transport requests, with expiry warnings.
        </p>
      </header>

      <section className="mb-8">
        <h2 className="mb-3 font-display text-lg font-semibold">
          Awaiting review ({needsReview.length})
        </h2>
        {query.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : needsReview.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-6 text-center">
            <FileText className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Nothing awaiting review.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {needsReview.map((d) => (
              <DocRow key={d.id} d={d} reviewMutation={reviewMutation} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">
          Expiring or expired ({expiring.length})
        </h2>
        {expiring.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-6 text-center">
            <p className="text-sm text-muted-foreground">Nothing expiring within 30 days.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {expiring.map((d) => (
              <DocRow key={d.id} d={d} reviewMutation={reviewMutation} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function DocRow({
  d,
  reviewMutation,
}: {
  d: OpsDocumentRow;
  reviewMutation: ReturnType<
    typeof useMutation<void, Error, { id: string; status: "accepted" | "rejected" }>
  >;
}) {
  const warning = documentExpiryWarning(d.expiry_date);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-4">
      <div>
        <div className="flex items-center gap-2 text-sm font-medium">
          {documentCategoryLabels[d.category] ?? d.category}
          {d.transport_requests?.request_number && (
            <Link
              to="/dashboard/operations/requests/$id"
              params={{ id: d.transport_request_id }}
              className="text-primary hover:underline"
            >
              {d.transport_requests.request_number}
            </Link>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {d.file_url && (
            <a
              href={d.file_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              View <ExternalLink className="size-3" />
            </a>
          )}
          {d.expiry_date && (
            <span>Expires {new Date(d.expiry_date).toLocaleDateString("en-GB")}</span>
          )}
          {warning && (
            <span className="inline-flex items-center gap-1 text-warning">
              <AlertTriangle className="size-3" />
              {warning === "expired" ? "Expired" : "Expires soon"}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="capitalize">
          {d.status.replace(/_/g, " ")}
        </Badge>
        {d.status === "uploaded" && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => reviewMutation.mutate({ id: d.id, status: "accepted" })}
              disabled={reviewMutation.isPending}
            >
              <CheckCircle2 className="mr-1 size-3.5" /> Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => reviewMutation.mutate({ id: d.id, status: "rejected" })}
              disabled={reviewMutation.isPending}
            >
              <XCircle className="mr-1 size-3.5" /> Reject
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
