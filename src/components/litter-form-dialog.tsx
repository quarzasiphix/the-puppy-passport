import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createLitter,
  listBreeds,
  listKennelParentDogs,
  updateLitter,
  type LitterRow,
} from "@/lib/queries/breeder";

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

const litterStatuses: LitterRow["status"][] = [
  "planned",
  "born",
  "applications_open",
  "fully_reserved",
  "completed",
  "cancelled",
];

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
  const queryClient = useQueryClient();
  const isEdit = !!litter;

  const breedsQuery = useQuery({ queryKey: ["breeds"], queryFn: listBreeds, enabled: open });
  const parentsQuery = useQuery({
    queryKey: ["kennel-parent-dogs", kennelId],
    queryFn: () => listKennelParentDogs(kennelId),
    enabled: open,
  });

  const form = useForm<FormValues>({ defaultValues: emptyValues(defaultStatus) });

  useEffect(() => {
    if (!open) return;
    if (litter) {
      form.reset({
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
      form.reset(emptyValues(defaultStatus));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, litter?.id, defaultStatus]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
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
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save litter."),
  });

  const mothers = (parentsQuery.data ?? []).filter((p) => p.sex === "female");
  const fathers = (parentsQuery.data ?? []).filter((p) => p.sex === "male");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit litter" : "Add litter"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-3">
            <FormField
              control={form.control}
              name="code"
              rules={{ required: true }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Litter name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Litter M — spring 2026" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="breedId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Breed</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select breed" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(breedsQuery.data ?? []).map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {litterStatuses.map((s) => (
                          <SelectItem key={s} value={s} className="capitalize">
                            {s.replace(/_/g, " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="motherId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mother</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              mothers.length ? "Select mother" : "Add a female parent dog first"
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {mothers.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.registered_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fatherId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Father</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              fathers.length ? "Select father" : "Add a male parent dog first"
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {fathers.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.registered_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="expectedBirthDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expected birth</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="birthDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Actual birth</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="readyDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ready to go home</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="puppyCount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expected number of puppies</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="association"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Association</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. ZKwP / FCI" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="registrationNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Registration number</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (visible to you only for now)</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex items-center justify-between rounded-xl border border-border/70 p-3">
              <div>
                <Label>Publish this litter publicly</Label>
                <p className="text-xs text-muted-foreground">
                  Off = only visible to you. On = visible on your public kennel page.
                </p>
              </div>
              <Switch
                checked={form.watch("isPublished")}
                onCheckedChange={(v) => form.setValue("isPublished", v)}
              />
            </div>

            <Button type="submit" disabled={mutation.isPending} className="w-full">
              {isEdit ? "Save changes" : "Add litter"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
