import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Eye, Plus, XCircle } from "lucide-react";
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
  getSignedDocumentUrl,
  listMyDocuments,
  reviewDocument,
  submitDocument,
} from "@/lib/queries/transport";
import type { TransportDocumentCategory } from "@/lib/supabase/enums";

// The transport-documents Storage bucket is private — there is no public URL to link to, only a
// short-lived signed URL generated on demand right before opening it (never persisted or shown as
// a bare href). See getSignedDocumentUrl() in src/lib/queries/transport.ts.
function ViewDocumentButton({ objectPath }: { objectPath: string }) {
  const [loading, setLoading] = useState(false);
  return (
    <Button
      type="button"
      variant="link"
      size="sm"
      className="h-auto gap-1 p-0 text-primary"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          const url = await getSignedDocumentUrl(objectPath);
          window.open(url, "_blank", "noopener,noreferrer");
        } catch {
          toast.error("Could not open this document.");
        } finally {
          setLoading(false);
        }
      }}
    >
      <Eye className="size-3" /> View
    </Button>
  );
}

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
  const [file, setFile] = useState<File | null>(null);
  const [expiryDate, setExpiryDate] = useState("");

  const query = useQuery({
    queryKey: ["transport-documents", transportRequestId],
    queryFn: () => listMyDocuments(transportRequestId),
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      submitDocument({
        transportRequestId,
        // The select control only ever offers real transport_document_category option values.
        category: category as TransportDocumentCategory,
        file: file!,
        expiryDate: expiryDate || null,
        uploadedBy: userId,
      }),
    onSuccess: () => {
      toast.success("Document uploaded — operations will review it.");
      setOpen(false);
      setCategory("");
      setFile(null);
      setExpiryDate("");
      queryClient.invalidateQueries({ queryKey: ["transport-documents", transportRequestId] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not upload document."),
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
                  <Label>File</Label>
                  <Input
                    type="file"
                    accept="application/pdf,image/*"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Private — only you and Havenpaw operations can view it.
                  </p>
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
                  disabled={!category || !file || submitMutation.isPending}
                  onClick={() => submitMutation.mutate()}
                >
                  {submitMutation.isPending ? "Uploading…" : "Upload document"}
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
                      {doc.file_url && <ViewDocumentButton objectPath={doc.file_url} />}
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
