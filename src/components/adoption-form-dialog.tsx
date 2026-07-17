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
import { listBreeds } from "@/lib/queries/breeder";
import {
  createAdoptionAnimal,
  updateAdoptionAnimal,
  type FoundationAnimalRow,
} from "@/lib/queries/foundation";

type FormValues = {
  name: string;
  breedId: string;
  sex: "male" | "female" | "";
  approximateAge: string;
  color: string;
  adoptionFee: string;
  currency: string;
  description: string;
  temperament: string;
  idealHome: string;
};

const emptyValues: FormValues = {
  name: "",
  breedId: "",
  sex: "",
  approximateAge: "",
  color: "",
  adoptionFee: "",
  currency: "PLN",
  description: "",
  temperament: "",
  idealHome: "",
};

export function AdoptionFormDialog({
  orgId,
  trigger,
  animal,
}: {
  orgId: string;
  trigger: React.ReactNode;
  animal?: FoundationAnimalRow;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const isEdit = !!animal;

  const breedsQuery = useQuery({ queryKey: ["breeds"], queryFn: listBreeds, enabled: open });
  const form = useForm<FormValues>({ defaultValues: emptyValues });

  useEffect(() => {
    if (!open) return;
    if (animal) {
      form.reset({
        name: animal.name,
        breedId: animal.breed_id ?? "",
        sex: (animal.sex as "male" | "female" | null) ?? "",
        approximateAge: animal.approximate_age ?? "",
        color: animal.color ?? "",
        adoptionFee: animal.price?.toString() ?? "",
        currency: animal.currency ?? "PLN",
        description: animal.description ?? "",
        temperament: animal.temperament ?? "",
        idealHome: animal.ideal_home ?? "",
      });
    } else {
      form.reset(emptyValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, animal?.id]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        organization_id: orgId,
        listing_category: "adoption" as const,
        name: values.name,
        breed_id: values.breedId || null,
        sex: values.sex || null,
        approximate_age: values.approximateAge || null,
        color: values.color || null,
        price: values.adoptionFee ? Number(values.adoptionFee) : null,
        currency: values.currency || "PLN",
        description: values.description || null,
        temperament: values.temperament || null,
        ideal_home: values.idealHome || null,
      };
      if (isEdit) return updateAdoptionAnimal(animal.id, payload);
      return createAdoptionAnimal(payload);
    },
    onSuccess: () => {
      toast.success(isEdit ? "Updated." : "Added — it's still a draft until you publish it.");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["foundation-animals"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save."),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit animal" : "Add animal for adoption"}</DialogTitle>
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
                    <Input autoFocus placeholder="e.g. Reksio" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

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
                name="approximateAge"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Approximate age</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. About 3 years" {...field} />
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
                    <FormLabel>Breed (if known)</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Mixed / unknown" />
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
                name="adoptionFee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Adoption fee (optional)</FormLabel>
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
                  <FormLabel>Their story</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="How they came to you, their personality…"
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="temperament"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Temperament (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Gentle, good with children" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="idealHome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ideal home (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Active family, no other cats" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <p className="text-xs text-muted-foreground">
              New listings are saved as an unpublished draft. Publish once you're ready for adopters
              to see them.
            </p>

            <Button type="submit" disabled={mutation.isPending} className="w-full">
              {isEdit ? "Save changes" : "Add animal"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
