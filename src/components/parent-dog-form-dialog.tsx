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
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { listBreeds, type ParentDogRow } from "@/lib/queries/breeder";

type EditableParentDog = Pick<
  ParentDogRow,
  | "id"
  | "registered_name"
  | "call_name"
  | "sex"
  | "breed_id"
  | "date_of_birth"
  | "color"
  | "pedigree_number"
  | "titles"
  | "description"
>;

type FormValues = {
  registeredName: string;
  callName: string;
  sex: "male" | "female" | "";
  breedId: string;
  dateOfBirth: string;
  color: string;
  pedigreeNumber: string;
  titles: string;
  description: string;
};

const emptyValues: FormValues = {
  registeredName: "",
  callName: "",
  sex: "",
  breedId: "",
  dateOfBirth: "",
  color: "",
  pedigreeNumber: "",
  titles: "",
  description: "",
};

export function ParentDogFormDialog({
  kennelId,
  trigger,
  parentDog,
}: {
  kennelId: string;
  trigger: React.ReactNode;
  parentDog?: EditableParentDog;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const isEdit = !!parentDog;

  const breedsQuery = useQuery({ queryKey: ["breeds"], queryFn: listBreeds, enabled: open });
  const form = useForm<FormValues>({ defaultValues: emptyValues });

  useEffect(() => {
    if (!open) return;
    if (parentDog) {
      form.reset({
        registeredName: parentDog.registered_name,
        callName: parentDog.call_name ?? "",
        sex: parentDog.sex,
        breedId: parentDog.breed_id ?? "",
        dateOfBirth: parentDog.date_of_birth ?? "",
        color: parentDog.color ?? "",
        pedigreeNumber: parentDog.pedigree_number ?? "",
        titles: parentDog.titles ?? "",
        description: parentDog.description ?? "",
      });
    } else {
      form.reset(emptyValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, parentDog?.id]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const supabase = getSupabaseBrowserClient();
      const payload = {
        kennel_id: kennelId,
        registered_name: values.registeredName,
        call_name: values.callName || null,
        sex: values.sex as "male" | "female",
        breed_id: values.breedId || null,
        date_of_birth: values.dateOfBirth || null,
        color: values.color || null,
        pedigree_number: values.pedigreeNumber || null,
        titles: values.titles || null,
        description: values.description || null,
      };
      if (isEdit) {
        const { error } = await supabase.from("parent_dogs").update(payload).eq("id", parentDog.id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("parent_dogs").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(isEdit ? "Parent dog updated." : "Parent dog added.");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["kennel-parent-dogs"] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not save parent dog."),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit parent dog" : "Add parent dog"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="registeredName"
                rules={{ required: true }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Registered name</FormLabel>
                    <FormControl>
                      <Input autoFocus placeholder="e.g. Cichy Las Amber" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="callName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Call name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Amber" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="sex"
                rules={{ required: true }}
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
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
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
                name="pedigreeNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pedigree number</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="titles"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Titles (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Polish Champion" {...field} />
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
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <Button type="submit" disabled={mutation.isPending} className="w-full">
              {isEdit ? "Save changes" : "Add parent dog"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
