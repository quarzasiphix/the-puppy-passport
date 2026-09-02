import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, TrendingUp } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Badge } from "@/shared/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/shared/ui/form";
import { createRoute, listDemandClusters, listRoutes } from "@/domains/transport";

export const Route = createFileRoute("/dashboard/operations/routes/")({
  component: RoutesPage,
});

type FormValues = {
  routeName: string;
  departureDate: string;
  originCountry: string;
  destinationCountries: string;
  maxCapacity: string;
};

function RoutesPage() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["routes"], queryFn: listRoutes });
  const clustersQuery = useQuery({ queryKey: ["demand-clusters"], queryFn: listDemandClusters });
  const form = useForm<FormValues>({
    defaultValues: {
      routeName: "",
      departureDate: "",
      originCountry: "",
      destinationCountries: "",
      maxCapacity: "4",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      createRoute({
        route_name: values.routeName,
        departure_date: values.departureDate || null,
        origin_country: values.originCountry || null,
        destination_countries: values.destinationCountries
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
        max_capacity: Number(values.maxCapacity) || 1,
        status: "planning",
      }),
    onSuccess: () => {
      toast.success("Route created.");
      setOpen(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["routes"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not create route."),
  });

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-medium">Planned routes</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1 size-4" /> New route
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New planned route</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-3">
                <FormField
                  control={form.control}
                  name="routeName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Route name</FormLabel>
                      <FormControl>
                        <Input placeholder="Warsaw–Amsterdam shared route" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="departureDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Departure date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="maxCapacity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max capacity</FormLabel>
                        <FormControl>
                          <Input type="number" min={1} {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="originCountry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Origin country</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="destinationCountries"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Destination countries (comma separated)</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <Button type="submit" disabled={mutation.isPending}>
                  Create route
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </header>

      {!!clustersQuery.data?.length && (
        <section className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="size-4 text-muted-foreground" />
            <h2 className="font-display text-lg font-semibold">Demand clustering</h2>
            <span className="text-xs text-muted-foreground">
              From open route waitlist entries — use this to decide what to plan next.
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {clustersQuery.data.map((c) => (
              <div
                key={`${c.originCountry}-${c.destinationCountry}`}
                className="rounded-xl border border-border/70 bg-card p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">
                    {c.originCountry} → {c.destinationCountry}
                  </div>
                  <Badge>{c.count} waiting</Badge>
                </div>
                {c.earliestWanted && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Earliest wanted: {new Date(c.earliestWanted).toLocaleDateString("en-GB")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {query.data?.map((r) => (
          <Link
            key={r.id}
            to="/dashboard/operations/routes/$id"
            params={{ id: r.id }}
            className="rounded-2xl border border-border/70 bg-card p-5 transition-colors hover:bg-secondary/40"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="font-display text-lg font-semibold">{r.route_name}</div>
                <div className="text-sm text-muted-foreground">
                  {r.origin_country ?? "?"} → {r.destination_countries.join(", ") || "?"}
                </div>
              </div>
              <Badge variant="secondary" className="capitalize">
                {r.status}
              </Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>{r.route_number}</span>
              {r.departure_date && (
                <span>Departs {new Date(r.departure_date).toLocaleDateString("en-GB")}</span>
              )}
              <span>Capacity {r.max_capacity}</span>
            </div>
          </Link>
        ))}
        {query.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">No planned routes yet.</p>
        )}
      </div>
    </div>
  );
}
