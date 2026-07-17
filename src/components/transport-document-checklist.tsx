import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, ExternalLink, Plus, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  documentCategoryLabels,
  documentExpiryWarning,
  listMyDocuments,
  reviewDocument,
  submitDocument,
} from "@/lib/queries/transport";

const statusStyles: Record<string, string> = {
  uploaded: "bg-accent/15 text-accent",
  under_review: "bg-warning/20 text-foreground",
  accepted: "bg-success/15 text-success",
  rejected: "bg-destructive/10 text-destructive",
  expired: "bg-destructive/10 text-destructive",
  missing: "bg-muted text-muted-foreground",
  not_applicable: "bg-muted text-muted-foreground",
};

export function TransportDocumentChecklist({
  transportRequestId,
  userId,
  canReview = false,
}: {
  transportRequestId: string;
  userId: string;
  canReview?: boolean;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  const query = useQuery({
    queryKey: ["transport-documents", transportRequestId],
    queryFn: () => listMyDocuments(transportRequestId),
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      submitDocument({
        transportRequestId,
        category,
        fileUrl,
        expiryDate: expiryDate || null,
        uploadedBy: userId,
      }),
    onSuccess: () => {
      toast.success("Document added — operations will review it.");
      setOpen(false);
      setCategory("");
      setFileUrl("");
      setExpiryDate("");
      queryClient.invalidateQueries({ queryKey: ["transport-documents", transportRequestId] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not add document."),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "accepted" | "rejected" }) =>
      reviewDocument(id, status, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transport-documents", transportRequestId] });
      toast.success("Updated.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update."),
  });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">Documents</h3>
        {!canReview && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="mr-1 size-4" /> Add document
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add a document</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Document type</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(documentCategoryLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Link to the document</Label>
                  <Input
                    placeholder="https://…"
                    value={fileUrl}
                    onChange={(e) => setFileUrl(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Expiry date (if it has one)</Label>
                  <Input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full"
                  disabled={!category || !fileUrl || submitMutation.isPending}
                  onClick={() => submitMutation.mutate()}
                >
                  Add document
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !query.data?.length ? (
        <p className="text-sm text-muted-foreground">
          {canReview ? "No documents submitted yet." : "No documents added yet."}
        </p>
      ) : (
        <ul className="space-y-2">
          {query.data.map((doc) => {
            const warning = documentExpiryWarning(doc.expiry_date);
            return (
              <li key={doc.id} className="rounded-xl border border-border/70 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium">
                      {documentCategoryLabels[doc.category] ?? doc.category}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {doc.file_url && (
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          View <ExternalLink className="size-3" />
                        </a>
                      )}
                      {doc.expiry_date && (
                        <span>Expires {new Date(doc.expiry_date).toLocaleDateString("en-GB")}</span>
                      )}
                      {warning && (
                        <span className="inline-flex items-center gap-1 text-warning">
                          <AlertTriangle className="size-3" />
                          {warning === "expired" ? "Expired" : "Expires soon"}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge className={statusStyles[doc.status] ?? "bg-muted text-muted-foreground"}>
                    {doc.status.replace(/_/g, " ")}
                  </Badge>
                </div>
                {canReview && doc.status === "uploaded" && (
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => reviewMutation.mutate({ id: doc.id, status: "accepted" })}
                      disabled={reviewMutation.isPending}
                    >
                      <CheckCircle2 className="mr-1 size-3.5" /> Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => reviewMutation.mutate({ id: doc.id, status: "rejected" })}
                      disabled={reviewMutation.isPending}
                    >
                      <XCircle className="mr-1 size-3.5" /> Reject
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
