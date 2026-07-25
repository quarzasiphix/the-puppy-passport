import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useAuth } from "@/hooks/use-auth";
import {
  createQuotation,
  listOpsQuotations,
  listRequestsNeedingQuotation,
  sendQuotation,
} from "@/lib/queries/operations";
import type { TransportServiceType } from "@/lib/supabase/enums";

export const Route = createFileRoute("/dashboard/operations/quotations")({
  component: QuotationsPage,
});

type FormValues = {
  transportRequestId: string;
  serviceType: string;
  basePrice: string;
  totalPrice: string;
  currency: string;
  expiryDate: string;
};

const statusStyles: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-accent/15 text-accent",
  viewed: "bg-accent/15 text-accent",
  accepted: "bg-success/15 text-success",
  rejected: "bg-destructive/10 text-destructive",
  expired: "bg-destructive/10 text-destructive",
  replaced: "bg-muted text-muted-foreground",
};

function QuotationsPage() {
  const { userId } = useAuth();
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const query = useQuery({ queryKey: ["ops-quotations"], queryFn: listOpsQuotations });
  const requestsQuery = useQuery({
    queryKey: ["requests-needing-quotation"],
    queryFn: listRequestsNeedingQuotation,
    enabled: open,
  });

  const form = useForm<FormValues>({
    defaultValues: {
      transportRequestId: "",
      serviceType: "individual",
      basePrice: "",
      totalPrice: "",
      currency: "EUR",
      expiryDate: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: FormValues) =>
      createQuotation({
        transportRequestId: values.transportRequestId,
        // The select control only ever offers real transport_service_type option values -- TS
        // can't statically prove that through react-hook-form's plain string field type.
        serviceType: values.serviceType as TransportServiceType,
        basePrice: Number(values.basePrice),
        totalPrice: Number(values.totalPrice),
        currency: values.currency,
        expiryDate: values.expiryDate || null,
      }),
    onSuccess: () => {
      toast.success("Quotation drafted.");
      setOpen(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["ops-quotations"] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not create quotation."),
  });

  const sendMutation = useMutation({
    mutationFn: ({ id, transportRequestId }: { id: string; transportRequestId: string }) =>
      sendQuotation(id, transportRequestId, userId!),
    onSuccess: () => {
      toast.success("Sent to the customer.");
      queryClient.invalidateQueries({ queryKey: ["ops-quotations"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not send."),
  });

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-medium">Quotations</h1>
          <p className="text-sm text-muted-foreground">
            Prepare, send and track quotations for transport requests.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1 size-4" /> New quotation
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New quotation</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((v) => createMutation.mutate(v))}
                className="space-y-3"
              >
                <FormField
                  control={form.control}
                  name="transportRequestId"
                  rules={{ required: true }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Request</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a request" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(requestsQuery.data ?? []).map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.request_number} — {r.animal_name ?? "Animal"} (
                              {r.pickup_city ?? "?"} → {r.destination_city ?? "?"})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="serviceType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service type</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="shared">Shared</SelectItem>
                          <SelectItem value="individual">Individual</SelectItem>
                          <SelectItem value="express">Express</SelectItem>
                          <SelectItem value="vip">VIP</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <div className="grid gap-3 sm:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="basePrice"
                    rules={{ required: true }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Base price</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="totalPrice"
                    rules={{ required: true }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total price</FormLabel>
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
                            <SelectItem value="EUR">EUR</SelectItem>
                            <SelectItem value="PLN">PLN</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="expiryDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valid until (optional)</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={createMutation.isPending} className="w-full">
                  Save draft
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </header>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !query.data?.length ? (
        <p className="text-sm text-muted-foreground">No quotations yet.</p>
      ) : (
        <div className="space-y-2">
          {query.data.map((q) => (
            <div
              key={q.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <Link
                    to="/dashboard/operations/requests/$id"
                    params={{ id: q.transport_request_id }}
                    className="font-medium text-primary hover:underline"
                  >
                    {q.transport_requests?.request_number ?? "?"}
                  </Link>
                  <span className="text-sm text-muted-foreground">
                    {q.transport_requests?.animal_name ?? "Animal"} · {q.service_type}
                  </span>
                </div>
                <div className="text-sm font-medium">
                  {q.total_price?.toLocaleString()} {q.currency}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={statusStyles[q.status] ?? "bg-muted text-muted-foreground"}>
                  {q.status}
                </Badge>
                {q.status === "draft" && (
                  <Button
                    size="sm"
                    onClick={() =>
                      sendMutation.mutate({ id: q.id, transportRequestId: q.transport_request_id })
                    }
                    disabled={sendMutation.isPending}
                  >
                    <Send className="mr-1 size-3.5" /> Send
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
