import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertOctagon } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";
import { Label } from "@/shared/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { incidentTypeLabels, reportIncident } from "../services/driver";

export function ReportIncidentDialog({
  transportRequestId,
  reportedBy,
}: {
  transportRequestId: string;
  reportedBy: string;
}) {
  const [open, setOpen] = useState(false);
  const [incidentType, setIncidentType] = useState("");
  const [severity, setSeverity] = useState<"low" | "medium" | "high" | "critical">("low");
  const [description, setDescription] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      reportIncident({
        transportRequestId,
        reportedBy,
        incidentType: incidentType as Parameters<typeof reportIncident>[0]["incidentType"],
        severity,
        description,
      }),
    onSuccess: () => {
      toast.success("Incident reported to operations.");
      setOpen(false);
      setIncidentType("");
      setSeverity("low");
      setDescription("");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not report."),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="text-destructive">
          <AlertOctagon className="mr-1 size-4" /> Report an issue
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report an issue</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Type</Label>
            <Select value={incidentType} onValueChange={setIncidentType}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(incidentTypeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Severity</Label>
            <Select value={severity} onValueChange={(v) => setSeverity(v as typeof severity)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low — no immediate action needed</SelectItem>
                <SelectItem value="medium">Medium — operations should know soon</SelectItem>
                <SelectItem value="high">High — needs attention now</SelectItem>
                <SelectItem value="critical">
                  Critical — urgent, animal or safety at risk
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>What happened</Label>
            <Textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue…"
            />
          </div>
          <Button
            className="w-full"
            disabled={!incidentType || !description.trim() || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Send to operations
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
