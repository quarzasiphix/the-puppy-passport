import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/shared/ui/badge";
import { Switch } from "@/shared/ui/switch";
import { listMarketsForAdmin, setMarketEnabled } from "@/domains/operations";
import { getMaintenanceMode, setMaintenanceMode } from "@/domains/operations";

export const Route = createFileRoute("/dashboard/admin/settings")({
  component: SettingsPage,
});

const stateLabels: Record<string, string> = {
  unavailable: "Unavailable",
  discovery_only: "Discovery only",
  listings_available: "Listings available",
  adoption_available: "Adoption available",
  transport_requests_available: "Transport requests available",
  partner_transport: "Partner transport",
  full_anemalo_service: "Full Anemalo service",
};

function SettingsPage() {
  const queryClient = useQueryClient();
  const marketsQuery = useQuery({ queryKey: ["admin-markets"], queryFn: listMarketsForAdmin });
  const maintenanceQuery = useQuery({
    queryKey: ["admin-maintenance-mode"],
    queryFn: getMaintenanceMode,
  });

  const toggleMarket = useMutation({
    mutationFn: (input: { id: string; enabled: boolean }) =>
      setMarketEnabled(input.id, input.enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-markets"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update."),
  });

  const toggleMaintenance = useMutation({
    mutationFn: (enabled: boolean) => setMaintenanceMode(enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-maintenance-mode"] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not update maintenance mode."),
  });

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-medium">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Platform-wide configuration. Featured-organisation selection has moved to the{" "}
          <a href="/dashboard/admin/organisations" className="text-primary hover:underline">
            Organisations
          </a>{" "}
          page.
        </p>
      </header>

      <section>
        <h2 className="mb-1 font-display text-lg font-semibold">Maintenance mode</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          When enabled, every visitor sees a plain "down for maintenance" page instead of the app —
          use this before a risky migration or deploy, not as a general outage indicator.
        </p>
        {maintenanceQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          maintenanceQuery.data && (
            <div className="rounded-2xl border border-border/70 bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium">
                    {maintenanceQuery.data.enabled ? "Maintenance mode is ON" : "App is live"}
                  </div>
                  {maintenanceQuery.data.enabled && maintenanceQuery.data.enabled_at && (
                    <div className="text-xs text-muted-foreground">
                      Enabled {new Date(maintenanceQuery.data.enabled_at).toLocaleString()}
                    </div>
                  )}
                </div>
                <Switch
                  checked={maintenanceQuery.data.enabled}
                  onCheckedChange={(checked) => toggleMaintenance.mutate(checked)}
                />
              </div>
            </div>
          )
        )}
      </section>

      <section>
        <h2 className="mb-1 font-display text-lg font-semibold">Markets</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Per-country availability. Enabling a market does not itself upgrade its service level —
          each area (marketplace, adoption, transport, fundraising) is tracked separately below, and
          "full service" claims are never made without matching legal readiness.
        </p>
        {marketsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-3">
            {marketsQuery.data?.map((m) => (
              <div key={m.id} className="rounded-2xl border border-border/70 bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">
                      {m.display_name}{" "}
                      <span className="text-xs text-muted-foreground">({m.country_code})</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {m.supported_locales.join(", ") || m.default_locale} · {m.currency}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {m.enabled ? "Enabled" : "Disabled"}
                    </span>
                    <Switch
                      checked={m.enabled}
                      onCheckedChange={(checked) =>
                        toggleMarket.mutate({ id: m.id, enabled: checked })
                      }
                    />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <Badge variant="secondary">Marketplace: {stateLabels[m.marketplace_state]}</Badge>
                  <Badge variant="secondary">Adoption: {stateLabels[m.adoption_state]}</Badge>
                  <Badge variant="secondary">
                    Transport posting: {stateLabels[m.transport_post_state]}
                  </Badge>
                  <Badge variant="secondary">
                    Full transport: {stateLabels[m.transport_full_state]}
                  </Badge>
                  <Badge variant="secondary">Fundraising: {stateLabels[m.fundraising_state]}</Badge>
                  <Badge variant={m.legal_content_ready ? "secondary" : "destructive"}>
                    Legal content {m.legal_content_ready ? "ready" : "not ready"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
