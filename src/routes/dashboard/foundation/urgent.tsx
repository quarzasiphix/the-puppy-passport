import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Plus } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { useAuth } from "@/domains/identity";
import { getMyFoundation } from "@/domains/breeders";
import { getFriendlyErrorMessage } from "@/shared/lib/errors";
import {
  convertWelfareCaseToTransportDraft,
  createWelfareCase,
  listMyOrgWelfareCases,
  welfareCaseStatusLabels,
  type WelfareCaseRow,
} from "@/domains/transport";
import { useTranslation } from "@/shared/i18n";

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
  const { t } = useTranslation();
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
      toast.success(t("foundationPanel.urgent.submittedToast"));
      setOpen(false);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ["welfare-cases", orgQuery.data?.id] });
    },
    onError: (err) =>
      toast.error(getFriendlyErrorMessage(err, t("foundationPanel.urgent.submitFailed"))),
  });

  const convertMutation = useMutation({
    mutationFn: (caseId: string) => convertWelfareCaseToTransportDraft(caseId),
    onSuccess: () => {
      toast.success(t("foundationPanel.urgent.convertedToast"));
      queryClient.invalidateQueries({ queryKey: ["welfare-cases", orgQuery.data?.id] });
    },
    onError: (err) =>
      toast.error(getFriendlyErrorMessage(err, t("foundationPanel.urgent.convertFailed"))),
  });

  return (
    <div>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-medium">{t("foundationPanel.urgent.title")}</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            {t("foundationPanel.urgent.subtitle")}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={!orgQuery.data?.id}>
              <Plus className="mr-1 size-4" /> {t("foundationPanel.urgent.newCaseButton")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("foundationPanel.urgent.dialogTitle")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>{t("foundationPanel.urgent.fieldSituation")}</Label>
                <Textarea
                  rows={3}
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder={t("foundationPanel.urgent.situationPlaceholder")}
                />
              </div>
              <div>
                <Label>{t("foundationPanel.urgent.fieldUrgency")}</Label>
                <Select
                  value={form.urgency}
                  onValueChange={(v) => setForm({ ...form, urgency: v as FormValues["urgency"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="routine">
                      {t("foundationPanel.urgent.urgencyRoutine")}
                    </SelectItem>
                    <SelectItem value="urgent">
                      {t("foundationPanel.urgent.urgencyUrgent")}
                    </SelectItem>
                    <SelectItem value="critical">
                      {t("foundationPanel.urgent.urgencyCritical")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("foundationPanel.urgent.fieldAnimal")}</Label>
                <Input
                  value={form.animalName}
                  onChange={(e) => setForm({ ...form, animalName: e.target.value })}
                />
              </div>
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                <div>
                  <Label>{t("foundationPanel.urgent.fieldCurrentCity")}</Label>
                  <Input
                    value={form.locationCity}
                    onChange={(e) => setForm({ ...form, locationCity: e.target.value })}
                  />
                </div>
                <div>
                  <Label>{t("foundationPanel.urgent.fieldCurrentCountry")}</Label>
                  <Input
                    value={form.locationCountry}
                    onChange={(e) => setForm({ ...form, locationCountry: e.target.value })}
                  />
                </div>
                <div>
                  <Label>{t("foundationPanel.urgent.fieldDestinationCity")}</Label>
                  <Input
                    value={form.destinationCity}
                    onChange={(e) => setForm({ ...form, destinationCity: e.target.value })}
                  />
                </div>
                <div>
                  <Label>{t("foundationPanel.urgent.fieldDestinationCountry")}</Label>
                  <Input
                    value={form.destinationCountry}
                    onChange={(e) => setForm({ ...form, destinationCountry: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>{t("foundationPanel.urgent.fieldDeadline")}</Label>
                <Input
                  type="date"
                  value={form.deadline}
                  onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                />
              </div>
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                <div>
                  <Label>{t("foundationPanel.urgent.fieldContactName")}</Label>
                  <Input
                    value={form.contactName}
                    onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                  />
                </div>
                <div>
                  <Label>{t("foundationPanel.urgent.fieldContactPhone")}</Label>
                  <Input
                    value={form.contactPhone}
                    onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>{t("foundationPanel.urgent.fieldWelfareNotes")}</Label>
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
                {createMutation.isPending
                  ? t("foundationPanel.urgent.submitting")
                  : t("foundationPanel.urgent.submitCaseButton")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      {!orgQuery.isLoading && !orgQuery.data && (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {t("foundationPanel.urgent.notAvailableNote")}
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
          <p className="text-sm text-muted-foreground">{t("foundationPanel.urgent.emptyBody")}</p>
        )}
      </div>
    </div>
  );
}

const urgencyLabelKeys: Record<string, string> = {
  routine: "foundationPanel.urgent.urgencyRoutine",
  urgent: "foundationPanel.urgent.urgencyUrgent",
  critical: "foundationPanel.urgent.urgencyCritical",
};

function CaseCard({
  c,
  onConvert,
  isConverting,
}: {
  c: WelfareCaseRow;
  onConvert: () => void;
  isConverting: boolean;
}) {
  const { t } = useTranslation();
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
              {t(urgencyLabelKeys[c.urgency] ?? c.urgency)}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{c.reason}</p>
        </div>
        <Badge className={statusStyles[c.status]}>{welfareCaseStatusLabels[c.status]}</Badge>
      </div>
      {c.status === "accepted_for_assessment" && (
        <div className="mt-3 border-t border-border/60 pt-3">
          <Button size="sm" disabled={isConverting} onClick={onConvert}>
            {isConverting
              ? t("foundationPanel.urgent.startingButton")
              : t("foundationPanel.urgent.startTransportButton")}
          </Button>
        </div>
      )}
      {c.status === "converted_to_transport" && (
        <p className="mt-3 text-xs text-muted-foreground">
          {t("foundationPanel.urgent.convertedNote")}
        </p>
      )}
    </div>
  );
}
