import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/shared/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { createAchievement, listKennelParentDogs } from "../services/breeder";

type FormValues = {
  parentDogId: string;
  title: string;
  issuingBody: string;
  achievedOn: string;
  evidenceUrl: string;
};

const emptyValues: FormValues = {
  parentDogId: "",
  title: "",
  issuingBody: "",
  achievedOn: "",
  evidenceUrl: "",
};

export function AchievementFormDialog({
  kennelId,
  trigger,
}: {
  kennelId: string;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const parentDogsQuery = useQuery({
    queryKey: ["kennel-parent-dogs", kennelId],
    queryFn: () => listKennelParentDogs(kennelId),
    enabled: open,
  });
  const form = useForm<FormValues>({ defaultValues: emptyValues });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      createAchievement({
        kennel_id: kennelId,
        parent_dog_id: values.parentDogId,
        title: values.title,
        issuing_body: values.issuingBody || null,
        achieved_on: values.achievedOn || null,
        evidence_url: values.evidenceUrl || null,
      }),
    onSuccess: () => {
      toast.success(
        "Submitted for review — it'll show as verified once an admin checks the evidence.",
      );
      setOpen(false);
      form.reset(emptyValues);
      queryClient.invalidateQueries({ queryKey: ["kennel-achievements"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not submit."),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add an achievement</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-3">
            <FormField
              control={form.control}
              name="parentDogId"
              rules={{ required: true }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Which dog</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            parentDogsQuery.data?.length ? "Select a dog" : "Add a parent dog first"
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(parentDogsQuery.data ?? []).map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.registered_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="title"
              rules={{ required: true }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title / result</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Polish Champion" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="issuingBody"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Awarded by</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. ZKwP / FCI" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="achievedOn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="evidenceUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Evidence link (certificate photo, show result page, etc.)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://…" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <p className="text-xs text-muted-foreground">
              This won't be shown publicly as "verified" until an admin checks the evidence — it's a
              claim, not a certification, until then.
            </p>
            <Button type="submit" disabled={mutation.isPending} className="w-full">
              Submit for review
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
