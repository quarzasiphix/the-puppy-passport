import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/shared/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import {
  listMyFleetJobs,
  listDrivers,
  listVehicles,
  assignOwnDriverToJob,
  assignOwnVehicleToJob,
  isOnHold,
  type FleetJobRow,
  type DriverRow,
  type VehicleRow,
} from "@/domains/transport";
import { getFriendlyErrorMessage } from "@/shared/lib/errors";
import { useTranslation } from "@/shared/i18n";

export const Route = createFileRoute("/dashboard/transport-company/dispatch")({
  component: DispatchPage,
});

// A company's real dispatch: which of ITS OWN drivers/vehicles handles each job already routed to
// its fleet. listDrivers()/listVehicles() are already RLS-scoped to the caller's own company for a
// non-ops caller (same queries the Vehicles/Drivers pages use) — no client-side org filter needed
// here either. The two assign mutations are enforced server-side by assign_own_driver_to_job()/
// assign_own_vehicle_to_job() (20260914000000_transport_company_dispatch.sql): a company can only
// ever reassign a job already belonging to its fleet, and only to its own drivers/vehicles.
function DispatchPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const jobsQuery = useQuery({ queryKey: ["my-fleet-jobs"], queryFn: listMyFleetJobs });
  const driversQuery = useQuery({ queryKey: ["drivers"], queryFn: listDrivers });
  const vehiclesQuery = useQuery({ queryKey: ["vehicles"], queryFn: listVehicles });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["my-fleet-jobs"] });

  const assignDriver = useMutation({
    mutationFn: ({ requestId, driverId }: { requestId: string; driverId: string }) =>
      assignOwnDriverToJob(requestId, driverId),
    onSuccess: () => {
      toast.success(t("transportCompanyPanel.dispatch.driverAssignedToast"));
      invalidate();
    },
    onError: (err) =>
      toast.error(
        getFriendlyErrorMessage(err, t("transportCompanyPanel.dispatch.driverAssignFailed")),
      ),
  });

  const assignVehicle = useMutation({
    mutationFn: ({ requestId, vehicleId }: { requestId: string; vehicleId: string }) =>
      assignOwnVehicleToJob(requestId, vehicleId),
    onSuccess: () => {
      toast.success(t("transportCompanyPanel.dispatch.vehicleAssignedToast"));
      invalidate();
    },
    onError: (err) =>
      toast.error(
        getFriendlyErrorMessage(err, t("transportCompanyPanel.dispatch.vehicleAssignFailed")),
      ),
  });

  const jobs = jobsQuery.data ?? [];
  const drivers = driversQuery.data ?? [];
  const vehicles = vehiclesQuery.data ?? [];

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-2xl font-medium">
          {t("transportCompanyPanel.dispatch.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("transportCompanyPanel.dispatch.subtitle")}
        </p>
      </header>

      {jobsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">
          {t("transportCompanyPanel.dispatch.loading")}
        </p>
      ) : !jobs.length ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {t("transportCompanyPanel.dispatch.emptyBody")}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-4">{t("transportCompanyPanel.dispatch.colRequest")}</th>
                  <th className="p-4">{t("transportCompanyPanel.dispatch.colRoute")}</th>
                  <th className="p-4">{t("transportCompanyPanel.dispatch.colStatus")}</th>
                  <th className="p-4">{t("transportCompanyPanel.dispatch.colDriver")}</th>
                  <th className="p-4">{t("transportCompanyPanel.dispatch.colVehicle")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {jobs.map((j) => (
                  <JobRow
                    key={j.id}
                    job={j}
                    drivers={drivers}
                    vehicles={vehicles}
                    onAssignDriver={(driverId) =>
                      assignDriver.mutate({ requestId: j.id, driverId })
                    }
                    onAssignVehicle={(vehicleId) =>
                      assignVehicle.mutate({ requestId: j.id, vehicleId })
                    }
                    assigningDriver={assignDriver.isPending}
                    assigningVehicle={assignVehicle.isPending}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function JobRow({
  job,
  drivers,
  vehicles,
  onAssignDriver,
  onAssignVehicle,
  assigningDriver,
  assigningVehicle,
}: {
  job: FleetJobRow;
  drivers: DriverRow[];
  vehicles: VehicleRow[];
  onAssignDriver: (driverId: string) => void;
  onAssignVehicle: (vehicleId: string) => void;
  assigningDriver: boolean;
  assigningVehicle: boolean;
}) {
  const { t } = useTranslation();
  return (
    <tr>
      <td className="p-4 font-medium">{job.request_number}</td>
      <td className="p-4 text-muted-foreground">
        {job.pickup_city ?? job.pickup_country} → {job.destination_city ?? job.destination_country}
      </td>
      <td className="p-4">
        <Badge variant={isOnHold(job.status) ? "destructive" : "secondary"}>
          {job.status.replace(/_/g, " ")}
        </Badge>
      </td>
      <td className="p-4">
        {drivers.length === 0 ? (
          <span className="text-xs text-muted-foreground">
            {t("transportCompanyPanel.dispatch.noOwnDrivers")}
          </span>
        ) : (
          <Select
            value={job.assigned_driver_id ?? undefined}
            onValueChange={onAssignDriver}
            disabled={assigningDriver}
          >
            <SelectTrigger className="w-44">
              <SelectValue
                placeholder={t("transportCompanyPanel.dispatch.assignDriverPlaceholder")}
              />
            </SelectTrigger>
            <SelectContent>
              {drivers.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </td>
      <td className="p-4">
        {vehicles.length === 0 ? (
          <span className="text-xs text-muted-foreground">
            {t("transportCompanyPanel.dispatch.noOwnVehicles")}
          </span>
        ) : (
          <Select
            value={job.assigned_vehicle_id ?? undefined}
            onValueChange={onAssignVehicle}
            disabled={assigningVehicle}
          >
            <SelectTrigger className="w-44">
              <SelectValue
                placeholder={t("transportCompanyPanel.dispatch.assignVehiclePlaceholder")}
              />
            </SelectTrigger>
            <SelectContent>
              {vehicles.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </td>
    </tr>
  );
}
