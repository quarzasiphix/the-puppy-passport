import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Dog } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Switch } from "@/shared/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { BigField, PickerCard, ToggleButtonGroup, WizardProgress } from "@/domains/breeders";
import {
  createLitter,
  listBreeds,
  listKennelParentDogs,
  updateLitter,
  type LitterRow,
} from "../services/breeder";
import { getFriendlyErrorMessage } from "@/shared/lib/errors";
import { useTranslation } from "@/shared/i18n";

type FormValues = {
  code: string;
  breedId: string;
  motherId: string;
  fatherId: string;
  status: LitterRow["status"];
  birthDate: string;
  expectedBirthDate: string;
  readyDate: string;
  puppyCount: string;
  association: string;
  registrationNumber: string;
  description: string;
  isPublished: boolean;
};

const emptyValues = (defaultStatus: LitterRow["status"]): FormValues => ({
  code: "",
  breedId: "",
  motherId: "",
  fatherId: "",
  status: defaultStatus,
  birthDate: "",
  expectedBirthDate: "",
  readyDate: "",
  puppyCount: "",
  association: "",
  registrationNumber: "",
  description: "",
  isPublished: false,
});

export function LitterFormDialog({
  kennelId,
  trigger,
  defaultStatus = "planned",
  litter,
}: {
  kennelId: string;
  trigger: React.ReactNode;
  defaultStatus?: LitterRow["status"];
  litter?: LitterRow;
}) {
  const { t } = useTranslation();
  const STEPS = [
    t("breederPanel.litterForm.stepBasics"),
    t("breederPanel.litterForm.stepParents"),
    t("breederPanel.litterForm.stepDates"),
    t("breederPanel.litterForm.stepRegistration"),
  ];
  const STATUS_OPTIONS: { value: LitterRow["status"]; label: string }[] = [
    { value: "planned", label: t("breederPanel.status.litter.planned") },
    { value: "born", label: t("breederPanel.status.litter.born") },
    { value: "applications_open", label: t("breederPanel.status.litter.applicationsOpen") },
    { value: "fully_reserved", label: t("breederPanel.status.litter.fullyReserved") },
    { value: "completed", label: t("breederPanel.status.litter.completed") },
    { value: "cancelled", label: t("breederPanel.status.litter.cancelled") },
  ];

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const queryClient = useQueryClient();
  const posthog = usePostHog();
  const isEdit = !!litter;

  const breedsQuery = useQuery({ queryKey: ["breeds"], queryFn: listBreeds, enabled: open });
  const parentsQuery = useQuery({
    queryKey: ["kennel-parent-dogs", kennelId],
    queryFn: () => listKennelParentDogs(kennelId),
    enabled: open,
  });

  const [values, setValues] = useState<FormValues>(emptyValues(defaultStatus));

  useEffect(() => {
    if (!open) return;
    setStep(0);
    if (litter) {
      setValues({
        code: litter.code,
        breedId: litter.breed_id ?? "",
        motherId: litter.mother_id ?? "",
        fatherId: litter.father_id ?? "",
        status: litter.status,
        birthDate: litter.birth_date ?? "",
        expectedBirthDate: litter.expected_birth_date ?? "",
        readyDate: litter.ready_date ?? "",
        puppyCount: litter.puppy_count?.toString() ?? "",
        association: litter.association ?? "",
        registrationNumber: litter.registration_number ?? "",
        description: "",
        isPublished: litter.is_published,
      });
    } else {
      setValues(emptyValues(defaultStatus));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, litter?.id, defaultStatus]);

  function set<K extends keyof FormValues>(key: K, v: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        kennel_id: kennelId,
        code: values.code,
        breed_id: values.breedId || null,
        mother_id: values.motherId || null,
        father_id: values.fatherId || null,
        status: values.status,
        birth_date: values.birthDate || null,
        expected_birth_date: values.expectedBirthDate || null,
        ready_date: values.readyDate || null,
        puppy_count: values.puppyCount ? Number(values.puppyCount) : null,
        association: values.association || null,
        registration_number: values.registrationNumber || null,
        description: values.description || null,
        is_published: values.isPublished,
      };
      if (isEdit) return updateLitter(litter.id, payload);
      return createLitter(payload);
    },
    onSuccess: () => {
      posthog.capture("litter_listing_saved", {
        is_edit: isEdit,
        status: values.status,
        is_published: values.isPublished,
      });
      toast.success(
        isEdit
          ? t("breederPanel.litterForm.savedUpdated")
          : t("breederPanel.litterForm.savedAdded"),
      );
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["kennel-litters"] });
      queryClient.invalidateQueries({ queryKey: ["kennel-litter", litter?.id] });
    },
    onError: (err) =>
      toast.error(getFriendlyErrorMessage(err, t("breederPanel.litterForm.saveFailed"))),
  });

  const mothers = (parentsQuery.data ?? []).filter((p) => p.sex === "female");
  const fathers = (parentsQuery.data ?? []).filter((p) => p.sex === "male");
  const canContinue = step !== 0 || values.code.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {isEdit
              ? t("breederPanel.litterForm.editTitle")
              : t("breederPanel.litterForm.addTitle")}
          </DialogTitle>
        </DialogHeader>

        <WizardProgress steps={STEPS} current={step} />

        <div className="space-y-4">
          {step === 0 && (
            <>
              <BigField
                label={t("breederPanel.litterForm.nameLabel")}
                hint={t("breederPanel.litterForm.nameHint")}
              >
                <Input
                  autoFocus
                  placeholder={t("breederPanel.litterForm.namePlaceholder")}
                  value={values.code}
                  onChange={(e) => set("code", e.target.value)}
                  className="h-14 rounded-2xl text-base"
                />
              </BigField>
              <BigField label={t("breederPanel.litterForm.breedLabel")}>
                <Select value={values.breedId} onValueChange={(v) => set("breedId", v)}>
                  <SelectTrigger className="h-14 rounded-2xl text-base">
                    <SelectValue placeholder={t("breederPanel.litterForm.breedPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {(breedsQuery.data ?? []).map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </BigField>
              <BigField label={t("breederPanel.litterForm.statusLabel")}>
                <ToggleButtonGroup
                  options={STATUS_OPTIONS}
                  value={values.status}
                  onChange={(v) => set("status", v)}
                  columns={1}
                  tone="accent"
                />
              </BigField>
            </>
          )}

          {step === 1 && (
            <>
              <BigField
                label={t("breederPanel.litterForm.motherLabel")}
                hint={!mothers.length ? t("breederPanel.litterForm.motherHint") : undefined}
              >
                <div className="space-y-2">
                  {mothers.map((p) => (
                    <PickerCard
                      key={p.id}
                      selected={values.motherId === p.id}
                      onClick={() => set("motherId", p.id)}
                      title={p.registered_name}
                      subtitle={p.call_name ?? undefined}
                      icon={Dog}
                    />
                  ))}
                </div>
              </BigField>
              <BigField
                label={t("breederPanel.litterForm.fatherLabel")}
                hint={!fathers.length ? t("breederPanel.litterForm.fatherHint") : undefined}
              >
                <div className="space-y-2">
                  {fathers.map((p) => (
                    <PickerCard
                      key={p.id}
                      selected={values.fatherId === p.id}
                      onClick={() => set("fatherId", p.id)}
                      title={p.registered_name}
                      subtitle={p.call_name ?? undefined}
                      icon={Dog}
                    />
                  ))}
                </div>
              </BigField>
            </>
          )}

          {step === 2 && (
            <>
              <BigField label={t("breederPanel.litterForm.expectedBirthLabel")}>
                <Input
                  type="date"
                  value={values.expectedBirthDate}
                  onChange={(e) => set("expectedBirthDate", e.target.value)}
                  className="h-14 rounded-2xl text-base"
                />
              </BigField>
              <BigField label={t("breederPanel.litterForm.actualBirthLabel")}>
                <Input
                  type="date"
                  value={values.birthDate}
                  onChange={(e) => set("birthDate", e.target.value)}
                  className="h-14 rounded-2xl text-base"
                />
              </BigField>
              <BigField label={t("breederPanel.litterForm.readyLabel")}>
                <Input
                  type="date"
                  value={values.readyDate}
                  onChange={(e) => set("readyDate", e.target.value)}
                  className="h-14 rounded-2xl text-base"
                />
              </BigField>
              <BigField label={t("breederPanel.litterForm.puppyCountLabel")}>
                <Input
                  type="number"
                  min="0"
                  value={values.puppyCount}
                  onChange={(e) => set("puppyCount", e.target.value)}
                  className="h-14 rounded-2xl text-base"
                />
              </BigField>
            </>
          )}

          {step === 3 && (
            <>
              <BigField
                label={t("breederPanel.litterForm.associationLabel")}
                hint={t("breederPanel.litterForm.associationHint")}
              >
                <Input
                  value={values.association}
                  onChange={(e) => set("association", e.target.value)}
                  className="h-14 rounded-2xl text-base"
                />
              </BigField>
              <BigField label={t("breederPanel.litterForm.registrationLabel")}>
                <Input
                  value={values.registrationNumber}
                  onChange={(e) => set("registrationNumber", e.target.value)}
                  className="h-14 rounded-2xl text-base"
                />
              </BigField>
              <BigField label={t("breederPanel.litterForm.notesLabel")}>
                <Textarea
                  rows={3}
                  value={values.description}
                  onChange={(e) => set("description", e.target.value)}
                  className="rounded-2xl text-base"
                />
              </BigField>
              <label className="flex items-center gap-3 rounded-2xl bg-secondary/60 p-4">
                <span className="flex-1">
                  <span className="block font-bold">
                    {t("breederPanel.litterForm.publishLabel")}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {t("breederPanel.litterForm.publishHint")}
                  </span>
                </span>
                <Switch
                  checked={values.isPublished}
                  onCheckedChange={(v) => set("isPublished", v)}
                />
              </label>
            </>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          {step > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep((s) => s - 1)}
              className="h-14 rounded-2xl border-2 text-base font-bold"
            >
              <ArrowLeft className="mr-1 size-4" /> {t("breederPanel.litterForm.back")}
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canContinue}
              className="h-14 flex-1 rounded-2xl text-base font-bold"
            >
              {t("breederPanel.litterForm.next")} <ArrowRight className="ml-1 size-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="h-14 flex-1 rounded-2xl text-base font-bold"
            >
              {mutation.isPending ? (
                t("breederPanel.litterForm.saving")
              ) : (
                <>
                  <Check className="mr-1 size-4" />{" "}
                  {isEdit
                    ? t("breederPanel.litterForm.saveChanges")
                    : t("breederPanel.litterForm.addLitter")}
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
