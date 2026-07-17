import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { createPuppy, listBreeds, updatePuppy, type AnimalRow } from "@/lib/queries/breeder";

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
  puppy?: AnimalRow;
}) {
  const [open, setOpen] = useState(false);
  const [addAnother, setAddAnother] = useState(false);
  const queryClient = useQueryClient();
  const isEdit = !!puppy;

  const breedsQuery = useQuery({ queryKey: ["breeds"], queryFn: listBreeds, enabled: open });
  const form = useForm<FormValues>({
    defaultValues: emptyValues(litterId ?? "", defaultBreedId ?? "", defaultDateOfBirth ?? ""),
  });

  useEffect(() => {
    if (!open) return;
    if (puppy) {
      form.reset({
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
      form.reset(emptyValues(litterId ?? "", defaultBreedId ?? "", defaultDateOfBirth ?? ""));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, puppy?.id, litterId, defaultBreedId, defaultDateOfBirth]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
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
      if (isEdit) return updatePuppy(puppy.id, payload);
      return createPuppy(payload);
    },
    onSuccess: () => {
      toast.success(
        isEdit ? "Puppy updated." : "Puppy added — it's still a draft until you publish it.",
      );
      queryClient.invalidateQueries({ queryKey: ["kennel-puppies"] });
      queryClient.invalidateQueries({ queryKey: ["litter-puppies"] });
      queryClient.invalidateQueries({ queryKey: ["kennel-litters"] });
      if (isEdit || !addAnother) {
        setOpen(false);
      } else {
        form.reset(emptyValues(litterId ?? "", defaultBreedId ?? "", defaultDateOfBirth ?? ""));
      }
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save puppy."),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit puppy" : "Add puppy"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-3">
            <FormField
              control={form.control}
              name="name"
              rules={{ required: true }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input autoFocus placeholder="e.g. Maja" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            {!!litterOptions?.length && (
              <FormField
                control={form.control}
                name="litterId"
                rules={{ required: true }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Litter</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select litter" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {litterOptions.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="sex"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sex</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="male">Male</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

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
                name="dateOfBirth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of birth</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="PLN">PLN</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="Temperament, notable traits…" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <p className="text-xs text-muted-foreground">
              New puppies are saved as an unpublished draft. Publish from the puppies list once
              you're ready for buyers to see them.
            </p>

            <div className="flex items-center gap-2">
              <Button
                type="submit"
                disabled={mutation.isPending}
                className="flex-1"
                onClick={() => setAddAnother(false)}
              >
                {isEdit ? "Save changes" : "Add puppy"}
              </Button>
              {!isEdit && (
                <Button
                  type="submit"
                  variant="outline"
                  disabled={mutation.isPending}
                  onClick={() => setAddAnother(true)}
                >
                  Add + another
                </Button>
              )}
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
