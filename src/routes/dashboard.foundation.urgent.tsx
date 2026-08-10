import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { getMyFoundation } from "@/lib/queries/foundation";
import { getFriendlyErrorMessage } from "@/lib/errors";
import {
  convertWelfareCaseToTransportDraft,
  createWelfareCase,
  listMyOrgWelfareCases,
  welfareCaseStatusLabels,
  type WelfareCaseRow,
} from "@/lib/queries/welfare";

export const Route = createFileRoute("/dashboard/foundation/urgent")({
  component: UrgentCasesPage,
});

const urgencyStyles: Record<string, string> = {
  routine: "bg-muted text-muted-foreground",
  urgent: "bg-warning/20 text-foreground",
  critical: "bg-destructive/10 text-destructive",
};

const statusStyles: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-accent/15 text-accent",
  under_review: "bg-accent/15 text-accent",
  information_required: "bg-warning/20 text-foreground",
  accepted_for_assessment: "bg-success/15 text-success",
  declined: "bg-destructive/10 text-destructive",
  converted_to_transport: "bg-success/15 text-success",
  closed: "bg-muted text-muted-foreground",
};

type FormValues = {
  reason: string;
  urgency: "routine" | "urgent" | "critical";
  animalName: string;
  locationCity: string;
  locationCountry: string;
  destinationCity: string;
  destinationCountry: string;
  deadline: string;
  contactName: string;
  contactPhone: string;
  welfareNotes: string;
};

const emptyForm: FormValues = {
  reason: "",
  urgency: "urgent",
  animalName: "",
  locationCity: "",
  locationCountry: "",
  destinationCity: "",
  destinationCountry: "",
  deadline: "",
  contactName: "",
  contactPhone: "",
  welfareNotes: "",
};

function UrgentCasesPage() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormValues>(emptyForm);

  const orgQuery = useQuery({
    queryKey: ["my-foundation", userId],
    enabled: !!userId,
    queryFn: () => getMyFoundation(userId!),
  });
  const casesQuery = useQuery({
    queryKey: ["welfare-cases", orgQuery.data?.id],
    enabled: !!orgQuery.data?.id,
    queryFn: () => listMyOrgWelfareCases(orgQuery.data!.id),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createWelfareCase({
        organisationId: orgQuery.data!.id,
        createdBy: userId!,
        reason: form.reason,
        urgency: form.urgency,
        animalName: form.animalName || undefined,
        locationCity: form.locationCity || undefined,
        locationCountry: form.locationCountry || undefined,
        destinationCity: form.destinationCity || undefined,
        destinationCountry: form.destinationCountry || undefined,
        deadline: form.deadline || null,
        contactName: form.contactName || undefined,
        contactPhone: form.contactPhone || undefined,
        welfareNotes: form.welfareNotes || undefined,
      }),
    onSuccess: () => {
      toast.success(
        "Case submitted — operations will review it. Submitting does not itself grant transport priority.",
      );
      setOpen(false);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ["welfare-cases", orgQuery.data?.id] });
    },
    onError: (err) => toast.error(getFriendlyErrorMessage(err, "Could not submit case.")),
  });

  const convertMutation = useMutation({
    mutationFn: (caseId: string) => convertWelfareCaseToTransportDraft(caseId),
    onSuccess: () => {
      toast.success("A transport draft has been started for this case.");
      queryClient.invalidateQueries({ queryKey: ["welfare-cases", orgQuery.data?.id] });
    },
    onError: (err) =>
      toast.error(getFriendlyErrorMessage(err, "Could not start a transport draft.")),
  });

  return (
    <div>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-medium">Urgent cases</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Flag a welfare-urgent animal or transport need for Anemalo operations. Submitting a case
            does not itself grant transport priority, bypass review, or confirm anything —
            operations assesses every case before it becomes a real transport request.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={!orgQuery.data?.id}>
              <Plus className="mr-1 size-4" /> New case
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Report an urgent case</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>What's the situation?</Label>
                <Textarea
                  rows={3}
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="Describe the animal's situation and why transport is needed."
                />
              </div>
              <div>
                <Label>Urgency</Label>
                <Select
                  value={form.urgency}
                  onValueChange={(v) => setForm({ ...form, urgency: v as FormValues["urgency"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="routine">Routine</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Animal (name or description)</Label>
                <Input
                  value={form.animalName}
                  onChange={(e) => setForm({ ...form, animalName: e.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Current city</Label>
                  <Input
                    value={form.locationCity}
                    onChange={(e) => setForm({ ...form, locationCity: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Current country</Label>
                  <Input
                    value={form.locationCountry}
                    onChange={(e) => setForm({ ...form, locationCountry: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Destination city</Label>
                  <Input
                    value={form.destinationCity}
                    onChange={(e) => setForm({ ...form, destinationCity: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Destination country</Label>
                  <Input
                    value={form.destinationCountry}
                    onChange={(e) => setForm({ ...form, destinationCountry: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>Deadline (if there is one)</Label>
                <Input
                  type="date"
                  value={form.deadline}
                  onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Contact name</Label>
                  <Input
                    value={form.contactName}
                    onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Contact phone</Label>
                  <Input
                    value={form.contactPhone}
                    onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>Welfare notes (for operations)</Label>
                <Textarea
                  rows={2}
                  value={form.welfareNotes}
                  onChange={(e) => setForm({ ...form, welfareNotes: e.target.value })}
                />
              </div>
              <Button
                className="w-full"
                disabled={!form.reason || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? "Submitting…" : "Submit case"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      {!orgQuery.isLoading && !orgQuery.data && (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Urgent cases are only available to approved foundation, shelter and rescue
            organisations.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {casesQuery.data?.map((c) => (
          <CaseCard
            key={c.id}
            c={c}
            onConvert={() => convertMutation.mutate(c.id)}
            isConverting={convertMutation.isPending}
          />
        ))}
        {casesQuery.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">No urgent cases reported yet.</p>
        )}
      </div>
    </div>
  );
}

function CaseCard({
  c,
  onConvert,
  isConverting,
}: {
  c: WelfareCaseRow;
  onConvert: () => void;
  isConverting: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-display text-lg font-semibold">
              {c.animal_name || c.case_number}
            </span>
            <Badge className={urgencyStyles[c.urgency]}>
              {c.urgency === "critical" && <AlertTriangle className="mr-1 size-3" />}
              {c.urgency}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{c.reason}</p>
        </div>
        <Badge className={statusStyles[c.status]}>{welfareCaseStatusLabels[c.status]}</Badge>
      </div>
      {c.status === "accepted_for_assessment" && (
        <div className="mt-3 border-t border-border/60 pt-3">
          <Button size="sm" disabled={isConverting} onClick={onConvert}>
            {isConverting ? "Starting…" : "Start a transport request for this case"}
          </Button>
        </div>
      )}
      {c.status === "converted_to_transport" && (
        <p className="mt-3 text-xs text-muted-foreground">
          A transport request has been started from this case.
        </p>
      )}
    </div>
  );
}
