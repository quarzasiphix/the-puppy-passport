import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Camera, Check, X } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
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
  createPuppy,
  listBreeds,
  updatePuppy,
  uploadAnimalCoverPhoto,
  animalCoverPhotoUrl,
  type AnimalRow,
} from "../services/breeder";
import { getFriendlyErrorMessage } from "@/shared/lib/errors";
import { useTranslation } from "@/shared/i18n";

type FormValues = {
  name: string;
  litterId: string;
  breedId: string;
  sex: "male" | "female" | "";
  color: string;
  dateOfBirth: string;
  price: string;
  currency: string;
  description: string;
};

const emptyValues = (litterId: string, breedId: string, dateOfBirth: string): FormValues => ({
  name: "",
  litterId,
  breedId,
  sex: "",
  color: "",
  dateOfBirth,
  price: "",
  currency: "PLN",
  description: "",
});

export function PuppyFormDialog({
  kennelId,
  trigger,
  litterId,
  litterOptions,
  defaultBreedId,
  defaultDateOfBirth,
  puppy,
}: {
  kennelId: string;
  trigger: React.ReactNode;
  litterId?: string;
  litterOptions?: { id: string; code: string }[];
  defaultBreedId?: string;
  defaultDateOfBirth?: string;
  puppy?: AnimalRow & { animal_images?: { image_url: string; is_cover: boolean }[] };
}) {
  const { t } = useTranslation();
  const STEPS = [
    t("breederPanel.puppyForm.stepBasics"),
    t("breederPanel.puppyForm.stepPhoto"),
    t("breederPanel.puppyForm.stepDetails"),
    t("breederPanel.puppyForm.stepPrice"),
  ];
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const queryClient = useQueryClient();
  const isEdit = !!puppy;
  const showLitterPicker = !isEdit && !!litterOptions?.length;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const existingPhotoUrl = puppy
    ? animalCoverPhotoUrl({ animal_images: puppy.animal_images ?? [] })
    : null;

  const breedsQuery = useQuery({ queryKey: ["breeds"], queryFn: listBreeds, enabled: open });
  const [values, setValues] = useState<FormValues>(
    emptyValues(litterId ?? "", defaultBreedId ?? "", defaultDateOfBirth ?? ""),
  );

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setPhotoFile(null);
    setPhotoPreview(null);
    if (puppy) {
      setValues({
        name: puppy.name,
        litterId: puppy.litter_id ?? "",
        breedId: puppy.breed_id ?? "",
        sex: (puppy.sex as "male" | "female" | null) ?? "",
        color: puppy.color ?? "",
        dateOfBirth: puppy.date_of_birth ?? "",
        price: puppy.price?.toString() ?? "",
        currency: puppy.currency ?? "PLN",
        description: puppy.description ?? "",
      });
    } else {
      setValues(emptyValues(litterId ?? "", defaultBreedId ?? "", defaultDateOfBirth ?? ""));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, puppy?.id, litterId, defaultBreedId, defaultDateOfBirth]);

  function set<K extends keyof FormValues>(key: K, v: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        organization_id: kennelId,
        listing_category: "breeder_puppy" as const,
        litter_id: values.litterId || null,
        name: values.name,
        breed_id: values.breedId || null,
        sex: values.sex || null,
        color: values.color || null,
        date_of_birth: values.dateOfBirth || null,
        price: values.price ? Number(values.price) : null,
        currency: values.currency || "PLN",
        description: values.description || null,
      };
      const animalId = isEdit ? puppy.id : (await createPuppy(payload)).id;
      if (isEdit) await updatePuppy(puppy.id, payload);

      if (photoFile) {
        try {
          await uploadAnimalCoverPhoto(kennelId, animalId, photoFile);
        } catch (err) {
          // The puppy record itself already saved successfully above — a photo-upload failure
          // shouldn't look like the whole save failed, just flag it separately.
          toast.error(getFriendlyErrorMessage(err, t("breederPanel.puppyForm.photoUploadFailed")));
        }
      }
    },
    onSuccess: () => {
      toast.success(
        isEdit
          ? t("breederPanel.puppyForm.savedUpdated")
          : t("breederPanel.puppyForm.savedAddedDraft"),
      );
      queryClient.invalidateQueries({ queryKey: ["kennel-puppies"] });
      queryClient.invalidateQueries({ queryKey: ["litter-puppies"] });
      queryClient.invalidateQueries({ queryKey: ["kennel-litters"] });
      setOpen(false);
    },
    onError: (err) =>
      toast.error(getFriendlyErrorMessage(err, t("breederPanel.puppyForm.saveFailed"))),
  });

  const canContinue =
    step !== 0 || (values.name.trim().length > 0 && (!showLitterPicker || !!values.litterId));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {isEdit ? t("breederPanel.puppyForm.editTitle") : t("breederPanel.puppyForm.addTitle")}
          </DialogTitle>
        </DialogHeader>

        <WizardProgress steps={STEPS} current={step} />

        <div className="space-y-4">
          {step === 0 && (
            <>
              <BigField label={t("breederPanel.puppyForm.nameLabel")}>
                <Input
                  autoFocus
                  placeholder={t("breederPanel.puppyForm.namePlaceholder")}
                  value={values.name}
                  onChange={(e) => set("name", e.target.value)}
                  className="h-14 rounded-2xl text-base"
                />
              </BigField>

              {showLitterPicker && (
                <BigField label={t("breederPanel.puppyForm.litterLabel")}>
                  <div className="space-y-2">
                    {litterOptions!.map((l) => (
                      <PickerCard
                        key={l.id}
                        selected={values.litterId === l.id}
                        onClick={() => set("litterId", l.id)}
                        title={l.code}
                      />
                    ))}
                  </div>
                </BigField>
              )}

              <BigField label={t("breederPanel.puppyForm.sexLabel")}>
                <ToggleButtonGroup
                  options={[
                    { value: "female", label: t("breederPanel.puppyForm.female") },
                    { value: "male", label: t("breederPanel.puppyForm.male") },
                  ]}
                  value={values.sex || "female"}
                  onChange={(v) => set("sex", v)}
                />
              </BigField>
            </>
          )}

          {step === 1 && (
            <BigField
              label={t("breederPanel.puppyForm.photoLabel")}
              hint={t("breederPanel.puppyForm.photoHint")}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  setPhotoFile(file);
                  setPhotoPreview(URL.createObjectURL(file));
                }}
              />
              {photoPreview || existingPhotoUrl ? (
                <div className="relative aspect-square w-40 overflow-hidden rounded-2xl">
                  <img
                    src={photoPreview ?? existingPhotoUrl!}
                    alt=""
                    className="size-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoFile(null);
                      setPhotoPreview(null);
                    }}
                    className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-white/95 text-destructive shadow"
                    aria-label={t("breederPanel.puppyForm.removePhoto")}
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 flex h-32 w-full flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-accent/40 bg-accent/10 text-accent"
              >
                <Camera className="size-8" />
                <span className="font-bold">
                  {photoPreview || existingPhotoUrl
                    ? t("breederPanel.puppyForm.changePhoto")
                    : t("breederPanel.puppyForm.addPhoto")}
                </span>
              </button>
            </BigField>
          )}

          {step === 2 && (
            <>
              <BigField label={t("breederPanel.puppyForm.breedLabel")}>
                <Select value={values.breedId} onValueChange={(v) => set("breedId", v)}>
                  <SelectTrigger className="h-14 rounded-2xl text-base">
                    <SelectValue placeholder={t("breederPanel.puppyForm.breedPlaceholder")} />
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
              <BigField label={t("breederPanel.puppyForm.colorLabel")}>
                <Input
                  value={values.color}
                  onChange={(e) => set("color", e.target.value)}
                  placeholder={t("breederPanel.puppyForm.colorPlaceholder")}
                  className="h-14 rounded-2xl text-base"
                />
              </BigField>
              <BigField label={t("breederPanel.puppyForm.dobLabel")}>
                <Input
                  type="date"
                  value={values.dateOfBirth}
                  onChange={(e) => set("dateOfBirth", e.target.value)}
                  className="h-14 rounded-2xl text-base"
                />
              </BigField>
            </>
          )}

          {step === 3 && (
            <>
              <div className="grid grid-cols-[1fr_auto] gap-3">
                <BigField label={t("breederPanel.puppyForm.priceLabel")}>
                  <Input
                    type="number"
                    min="0"
                    value={values.price}
                    onChange={(e) => set("price", e.target.value)}
                    className="h-14 rounded-2xl text-base"
                  />
                </BigField>
                <BigField label={t("breederPanel.puppyForm.currencyLabel")}>
                  <ToggleButtonGroup
                    options={[
                      { value: "PLN", label: "PLN" },
                      { value: "EUR", label: "EUR" },
                    ]}
                    value={values.currency}
                    onChange={(v) => set("currency", v)}
                    columns={2}
                  />
                </BigField>
              </div>
              <BigField
                label={t("breederPanel.puppyForm.descriptionLabel")}
                hint={t("breederPanel.puppyForm.descriptionHint")}
              >
                <Textarea
                  rows={4}
                  value={values.description}
                  onChange={(e) => set("description", e.target.value)}
                  className="rounded-2xl text-base"
                />
              </BigField>
              {!isEdit && (
                <p className="text-xs text-muted-foreground">
                  {t("breederPanel.puppyForm.draftNote")}
                </p>
              )}
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
              <ArrowLeft className="mr-1 size-4" /> {t("breederPanel.puppyForm.back")}
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canContinue}
              className="h-14 flex-1 rounded-2xl text-base font-bold"
            >
              {t("breederPanel.puppyForm.next")} <ArrowRight className="ml-1 size-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="h-14 flex-1 rounded-2xl text-base font-bold"
            >
              {mutation.isPending ? (
                t("breederPanel.puppyForm.saving")
              ) : (
                <>
                  <Check className="mr-1 size-4" />{" "}
                  {isEdit
                    ? t("breederPanel.puppyForm.saveChanges")
                    : t("breederPanel.puppyForm.addPuppy")}
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
