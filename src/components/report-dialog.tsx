import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Flag, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { useAuth } from "@/hooks/use-auth";
import { submitReport, type ReportReason, type ReportTargetType } from "@/lib/queries/moderation";
import { getFriendlyErrorMessage } from "@/lib/errors";

const reasonLabels: Record<ReportTargetType, { value: ReportReason; label: string }[]> = {
  animal_listing: [
    { value: "suspected_illegal_breeding", label: "Suspected illegal breeding" },
    { value: "false_breeder_information", label: "False information about the breeder" },
    { value: "stolen_animal", label: "This may be a stolen animal" },
    { value: "missing_or_false_microchip", label: "Missing or false microchip info" },
    { value: "animal_welfare_concern", label: "Animal welfare concern" },
    { value: "misleading_health_information", label: "Misleading health information" },
    { value: "scam_or_payment_fraud", label: "Scam or payment fraud" },
    { value: "duplicate_listing", label: "Duplicate listing" },
    { value: "prohibited_content", label: "Prohibited content" },
    { value: "other", label: "Something else" },
  ],
  organisation: [
    { value: "false_breeder_information", label: "False information" },
    { value: "animal_welfare_concern", label: "Animal welfare concern" },
    { value: "scam_or_payment_fraud", label: "Scam or payment fraud" },
    { value: "prohibited_content", label: "Prohibited content" },
    { value: "other", label: "Something else" },
  ],
  post: [
    { value: "prohibited_content", label: "Prohibited content" },
    { value: "scam_or_payment_fraud", label: "Scam or payment fraud" },
    { value: "other", label: "Something else" },
  ],
  message: [
    { value: "prohibited_content", label: "Prohibited content" },
    { value: "scam_or_payment_fraud", label: "Scam or payment fraud" },
    { value: "other", label: "Something else" },
  ],
  user: [
    { value: "scam_or_payment_fraud", label: "Scam or payment fraud" },
    { value: "prohibited_content", label: "Prohibited behaviour" },
    { value: "other", label: "Something else" },
  ],
};

export function ReportDialog({
  targetType,
  targetId,
  triggerLabel = "Report",
}: {
  targetType: ReportTargetType;
  targetId: string;
  triggerLabel?: string;
}) {
  const { userId } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | "">("");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      submitReport({
        reporterProfileId: userId!,
        targetType,
        targetId,
        reason: reason as ReportReason,
        description: description || null,
      }),
    onSuccess: () => setSubmitted(true),
    onError: (err) => toast.error(getFriendlyErrorMessage(err, "Could not send report.")),
  });

  if (!userId) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setSubmitted(false);
          setReason("");
          setDescription("");
        }
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
        >
          <Flag className="size-3.5" /> {triggerLabel}
        </button>
      </DialogTrigger>
      <DialogContent>
        {submitted ? (
          <div className="py-4 text-center">
            <CheckCircle2 className="mx-auto size-8 text-success" />
            <p className="mt-3 font-medium">Report sent</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Our team will review it. This isn't shown to anyone else.
            </p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Report this</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>What's the issue?</Label>
                <Select value={reason} onValueChange={(v) => setReason(v as ReportReason)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {reasonLabels[targetType].map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Details (optional)</Label>
                <Textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Anything that helps our team look into this."
                />
              </div>
              <Button
                className="w-full"
                disabled={!reason || mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                Send report
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
