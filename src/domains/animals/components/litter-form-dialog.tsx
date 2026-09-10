import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Dog } from "lucide-react";
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

const STATUS_OPTIONS: { value: LitterRow["status"]; label: string }[] = [
  { value: "planned", label: "Planned" },
  { value: "born", label: "Born" },
  { value: "applications_open", label: "Applications open" },
  { value: "fully_reserved", label: "Fully reserved" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const STEPS = ["Basics", "Parents", "Dates & size", "Registration"] as const;

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
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const queryClient = useQueryClient();
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
      toast.success(isEdit ? "Litter updated." : "Litter added.");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["kennel-litters"] });
      queryClient.invalidateQueries({ queryKey: ["kennel-litter", litter?.id] });
    },
    onError: (err) => toast.error(getFriendlyErrorMessage(err, "Could not save litter.")),
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
            {isEdit ? "Edit litter" : "Add a litter"}
          </DialogTitle>
        </DialogHeader>

        <WizardProgress steps={[...STEPS]} current={step} />

        <div className="space-y-4">
          {step === 0 && (
            <>
              <BigField label="Litter name" hint="How you'll recognize it, e.g. a season + letter.">
                <Input
                  autoFocus
                  placeholder="e.g. Litter M — spring 2026"
                  value={values.code}
                  onChange={(e) => set("code", e.target.value)}
                  className="h-14 rounded-2xl text-base"
                />
              </BigField>
              <BigField label="Breed">
                <Select value={values.breedId} onValueChange={(v) => set("breedId", v)}>
                  <SelectTrigger className="h-14 rounded-2xl text-base">
                    <SelectValue placeholder="Select breed" />
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
              <BigField label="Status">
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
                label="Mother"
                hint={
                  !mothers.length ? "Add a female parent dog first, under Parent dogs." : undefined
                }
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
                label="Father"
                hint={
                  !fathers.length ? "Add a male parent dog first, under Parent dogs." : undefined
                }
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
              <BigField label="Expected birth date">
                <Input
                  type="date"
                  value={values.expectedBirthDate}
                  onChange={(e) => set("expectedBirthDate", e.target.value)}
                  className="h-14 rounded-2xl text-base"
                />
              </BigField>
              <BigField label="Actual birth date">
                <Input
                  type="date"
                  value={values.birthDate}
                  onChange={(e) => set("birthDate", e.target.value)}
                  className="h-14 rounded-2xl text-base"
                />
              </BigField>
              <BigField label="Ready to go home">
                <Input
                  type="date"
                  value={values.readyDate}
                  onChange={(e) => set("readyDate", e.target.value)}
                  className="h-14 rounded-2xl text-base"
                />
              </BigField>
              <BigField label="Expected number of puppies">
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
              <BigField label="Association" hint="e.g. ZKwP / FCI">
                <Input
                  value={values.association}
                  onChange={(e) => set("association", e.target.value)}
                  className="h-14 rounded-2xl text-base"
                />
              </BigField>
              <BigField label="Registration number">
                <Input
                  value={values.registrationNumber}
                  onChange={(e) => set("registrationNumber", e.target.value)}
                  className="h-14 rounded-2xl text-base"
                />
              </BigField>
              <BigField label="Notes (visible to you only for now)">
                <Textarea
                  rows={3}
                  value={values.description}
                  onChange={(e) => set("description", e.target.value)}
                  className="rounded-2xl text-base"
                />
              </BigField>
              <label className="flex items-center gap-3 rounded-2xl bg-secondary/60 p-4">
                <span className="flex-1">
                  <span className="block font-bold">Publish this litter publicly</span>
                  <span className="block text-xs text-muted-foreground">
                    Off = only visible to you. On = visible on your public kennel page.
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
              <ArrowLeft className="mr-1 size-4" /> Back
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canContinue}
              className="h-14 flex-1 rounded-2xl text-base font-bold"
            >
              Next <ArrowRight className="ml-1 size-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="h-14 flex-1 rounded-2xl text-base font-bold"
            >
              {mutation.isPending ? (
                "Saving…"
              ) : (
                <>
                  <Check className="mr-1 size-4" /> {isEdit ? "Save changes" : "Add litter"}
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
