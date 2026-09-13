import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Route as RouteIcon,
  ArrowRight,
  Truck,
  Bell,
  CheckCircle2,
  Building2,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useAuth } from "@/domains/identity";
import {
  joinRouteWaitlist,
  listPublicTrips,
  submitTripJoinRequest,
  type PublicTripRow,
} from "@/domains/transport";
import { useTranslation } from "@/shared/i18n";

import { getFriendlyErrorMessage } from "@/shared/lib/errors";

// Redesigned into two tabs (was a single ops-only routes board): "Anemalo routes" keeps the
// original ops-planned public_routes content unchanged; "Company trips" is new — browsable,
// filterable public_trips (see 20260916000000_public_trips_and_join_requests.sql), with a
// lightweight "Request to join" ask per trip instead of a scored matching engine. Deliberately no
// geocoding/route-rendering here — pasted Maps links stay the MVP posture, per the approved plan.
export const Route = createFileRoute("/_public/planned-routes")({
  head: () => ({ meta: [{ title: "Planned routes — Anemalo" }] }),
  loader: async () => {
    const supabase = getSupabaseBrowserClient();
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: routes }, trips] = await Promise.all([
      supabase
        .from("public_routes")
        .select("*")
        .or(`departure_date.gte.${today},departure_date.is.null`)
        .order("departure_date", { ascending: true, nullsFirst: false }),
      listPublicTrips(),
    ]);
    return { routes: routes ?? [], trips };
  },
  component: PlannedRoutesPage,
});

function PlannedRoutesPage() {
  const { routes, trips } = Route.useLoaderData();
  const { t } = useTranslation();

  return (
    <div className="container-page py-10">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-accent">
          {t("plannedRoutesPage.eyebrow")}
        </p>
        <h1 className="mt-1 font-display text-4xl font-medium">{t("plannedRoutesPage.title")}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{t("plannedRoutesPage.subtitle")}</p>
      </header>

      <Tabs defaultValue="anemalo" className="w-full">
        <TabsList>
          <TabsTrigger value="anemalo">{t("plannedRoutesPage.tabAnemaloRoutes")}</TabsTrigger>
          <TabsTrigger value="company">{t("plannedRoutesPage.tabCompanyTrips")}</TabsTrigger>
        </TabsList>

        <TabsContent value="anemalo" className="mt-6">
          <AnemaloRoutesTab routes={routes} />
        </TabsContent>
        <TabsContent value="company" className="mt-6">
          <CompanyTripsTab trips={trips} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AnemaloRoutesTab({ routes }: { routes: Record<string, unknown>[] }) {
  const { t } = useTranslation();

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <WaitlistDialog />
      </div>
      {routes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-10 text-center">
          <RouteIcon className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">{t("plannedRoutesPage.emptyText")}</p>
          <Button asChild className="mt-4">
            <Link to="/transport/request">{t("plannedRoutesPage.requestTransport")}</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {routes.map((r) => (
            <div
              key={r.id as string}
              className="flex flex-col rounded-2xl border border-border/70 bg-card p-5"
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                {(r.origin_country as string) ?? (r.origin_region as string) ?? "?"}
                <ArrowRight className="size-4 text-muted-foreground" />
                {(r.destination_countries as string[] | null)?.join(", ") ||
                  (r.destination_regions as string[] | null)?.join(", ") ||
                  "?"}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge variant="secondary">{r.route_number as string}</Badge>
                <Badge variant="secondary" className="capitalize">
                  {r.status as string}
                </Badge>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>
                  <dt>{t("plannedRoutesPage.departure")}</dt>
                  <dd className="font-medium text-foreground">
                    {r.departure_date
                      ? new Date(r.departure_date as string).toLocaleDateString("en-GB")
                      : t("plannedRoutesPage.flexible")}
                  </dd>
                </div>
                <div>
                  <dt>{t("plannedRoutesPage.places")}</dt>
                  <dd className="font-medium text-foreground">
                    {((r.available_capacity as number | null) ?? 0) > 0
                      ? `${r.available_capacity} ${t("plannedRoutesPage.mayBeAvailableSuffix")}`
                      : t("plannedRoutesPage.likelyFull")}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-col gap-2">
                <Button asChild size="sm">
                  <Link to="/transport/request">
                    <Truck className="mr-1 size-4" /> {t("plannedRoutesPage.requestPlace")}
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to="/transport/request">{t("plannedRoutesPage.requestOther")}</Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const ALL = "__all__";

function CompanyTripsTab({ trips }: { trips: PublicTripRow[] }) {
  const { t, locale } = useTranslation();
  const [origin, setOrigin] = useState(ALL);
  const [destination, setDestination] = useState(ALL);

  const origins = useMemo(
    () => Array.from(new Set(trips.map((tr) => tr.origin_country).filter(Boolean))).sort(),
    [trips],
  );
  const destinations = useMemo(
    () => Array.from(new Set(trips.map((tr) => tr.destination_country).filter(Boolean))).sort(),
    [trips],
  );

  const filtered = trips.filter((tr) => {
    if (origin !== ALL && tr.origin_country !== origin) return false;
    if (destination !== ALL && tr.destination_country !== destination) return false;
    return true;
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-border/70 bg-card/60 p-3">
        <Select value={origin} onValueChange={setOrigin}>
          <SelectTrigger className="w-44 bg-background">
            <SelectValue placeholder={t("plannedRoutesPage.from")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("transportCompaniesPage.allCountries")}</SelectItem>
            {origins.map((c) => (
              <SelectItem key={c} value={c as string}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={destination} onValueChange={setDestination}>
          <SelectTrigger className="w-44 bg-background">
            <SelectValue placeholder={t("plannedRoutesPage.to")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("transportCompaniesPage.allCountries")}</SelectItem>
            {destinations.map((c) => (
              <SelectItem key={c} value={c as string}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(origin !== ALL || destination !== ALL) && (
          <Button
            variant="ghost"
            className="ml-auto"
            onClick={() => {
              setOrigin(ALL);
              setDestination(ALL);
            }}
          >
            {t("transportCompaniesPage.clearFilters")}
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-10 text-center">
          <Building2 className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            {t("plannedRoutesPage.companyTripsEmpty")}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((tr) => (
            <div
              key={tr.id}
              className="flex flex-col rounded-2xl border border-border/70 bg-card p-5"
            >
              <Link
                to="/@{$handle}"
                params={{ handle: tr.company_slug ?? "" }}
                className="text-sm font-medium text-primary hover:underline"
              >
                {tr.company_name}
              </Link>
              <div className="mt-1 flex items-center gap-2 text-sm font-medium">
                {tr.origin_country ?? "?"}
                <ArrowRight className="size-4 text-muted-foreground" />
                {tr.destination_country ?? "?"}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="size-3.5" />
                {tr.departure_date
                  ? new Date(tr.departure_date).toLocaleDateString(
                      locale === "pl" ? "pl-PL" : "en-GB",
                    )
                  : t("plannedRoutesPage.flexible")}
                <Badge variant="secondary" className="ml-1">
                  {tr.stop_count ?? 0} {t("plannedRoutesPage.companyTripStopsSuffix")}
                </Badge>
              </div>
              <div className="mt-4">
                <JoinTripDialog trip={tr} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type JoinFormState = {
  animalLabel: string;
  pickupMapsUrl: string;
  pickupContactName: string;
  pickupContactPhone: string;
  dropoffMapsUrl: string;
  dropoffContactName: string;
  dropoffContactPhone: string;
  notes: string;
};

const EMPTY_JOIN_FORM: JoinFormState = {
  animalLabel: "",
  pickupMapsUrl: "",
  pickupContactName: "",
  pickupContactPhone: "",
  dropoffMapsUrl: "",
  dropoffContactName: "",
  dropoffContactPhone: "",
  notes: "",
};

function JoinTripDialog({ trip }: { trip: PublicTripRow }) {
  const { userId } = useAuth();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<JoinFormState>(EMPTY_JOIN_FORM);
  const [submitted, setSubmitted] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      submitTripJoinRequest({
        trip_id: trip.id!,
        requesterProfileId: userId!,
        animal_label: form.animalLabel,
        pickup_maps_url: form.pickupMapsUrl || null,
        pickup_contact_name: form.pickupContactName || null,
        pickup_contact_phone: form.pickupContactPhone || null,
        dropoff_maps_url: form.dropoffMapsUrl || null,
        dropoff_contact_name: form.dropoffContactName || null,
        dropoff_contact_phone: form.dropoffContactPhone || null,
        notes: form.notes || null,
      }),
    onSuccess: () => setSubmitted(true),
    onError: (err) =>
      toast.error(getFriendlyErrorMessage(err, t("plannedRoutesPage.couldNotSubmitJoin"))),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setSubmitted(false);
          setForm(EMPTY_JOIN_FORM);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="w-full">
          <Truck className="mr-1 size-4" /> {t("plannedRoutesPage.requestToJoin")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        {!userId ? (
          <div className="py-4 text-center">
            <p className="text-sm text-muted-foreground">
              <Link to="/signin" className="text-primary hover:underline">
                {t("nav.signIn")}
              </Link>{" "}
              {t("plannedRoutesPage.signInToJoinPrefix")}
            </p>
          </div>
        ) : submitted ? (
          <div className="py-4 text-center">
            <CheckCircle2 className="mx-auto size-8 text-success" />
            <p className="mt-3 font-medium">{t("plannedRoutesPage.joinSubmittedTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("plannedRoutesPage.joinSubmittedBody")}
            </p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t("plannedRoutesPage.requestToJoin")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{t("transportCompanyPanel.trips.fieldAnimalLabel")}</Label>
                <Input
                  placeholder={t("transportCompanyPanel.trips.fieldAnimalLabelPlaceholder")}
                  value={form.animalLabel}
                  onChange={(e) => setForm((f) => ({ ...f, animalLabel: e.target.value }))}
                />
              </div>
              <div className="rounded-xl border border-border/60 p-3 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("transportCompanyPanel.trips.pickupSectionTitle")}
                </p>
                <Input
                  placeholder="https://maps.google.com/…"
                  value={form.pickupMapsUrl}
                  onChange={(e) => setForm((f) => ({ ...f, pickupMapsUrl: e.target.value }))}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder={t("transportCompanyPanel.trips.fieldContactName")}
                    value={form.pickupContactName}
                    onChange={(e) => setForm((f) => ({ ...f, pickupContactName: e.target.value }))}
                  />
                  <Input
                    placeholder={t("transportCompanyPanel.trips.fieldContactPhone")}
                    value={form.pickupContactPhone}
                    onChange={(e) => setForm((f) => ({ ...f, pickupContactPhone: e.target.value }))}
                  />
                </div>
              </div>
              <div className="rounded-xl border border-border/60 p-3 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("transportCompanyPanel.trips.dropoffSectionTitle")}
                </p>
                <Input
                  placeholder="https://maps.google.com/…"
                  value={form.dropoffMapsUrl}
                  onChange={(e) => setForm((f) => ({ ...f, dropoffMapsUrl: e.target.value }))}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder={t("transportCompanyPanel.trips.fieldContactName")}
                    value={form.dropoffContactName}
                    onChange={(e) => setForm((f) => ({ ...f, dropoffContactName: e.target.value }))}
                  />
                  <Input
                    placeholder={t("transportCompanyPanel.trips.fieldContactPhone")}
                    value={form.dropoffContactPhone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, dropoffContactPhone: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div>
                <Label>{t("transportCompanyPanel.trips.fieldNotes")}</Label>
                <Textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
              <Button
                className="w-full"
                disabled={!form.animalLabel.trim() || mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                {t("plannedRoutesPage.requestToJoin")}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function WaitlistDialog() {
  const { userId } = useAuth();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [earliestDate, setEarliestDate] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      joinRouteWaitlist({
        profileId: userId!,
        originCountry: origin,
        destinationCountry: destination,
        earliestDate: earliestDate || null,
      }),
    onSuccess: () => setSubmitted(true),
    onError: (err) =>
      toast.error(getFriendlyErrorMessage(err, t("plannedRoutesPage.couldNotJoin"))),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setSubmitted(false);
          setOrigin("");
          setDestination("");
          setEarliestDate("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="h-auto whitespace-normal text-left">
          <Bell className="mr-1 size-4 shrink-0" /> {t("plannedRoutesPage.waitlistTrigger")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        {!userId ? (
          <div className="py-4 text-center">
            <p className="text-sm text-muted-foreground">
              <Link to="/signin" className="text-primary hover:underline">
                {t("nav.signIn")}
              </Link>{" "}
              {t("plannedRoutesPage.signInToJoinPrefix")}
            </p>
          </div>
        ) : submitted ? (
          <div className="py-4 text-center">
            <CheckCircle2 className="mx-auto size-8 text-success" />
            <p className="mt-3 font-medium">{t("plannedRoutesPage.onListTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("plannedRoutesPage.onListBody")}
            </p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t("plannedRoutesPage.waitlistTitle")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t("plannedRoutesPage.from")}</Label>
                  <Input
                    placeholder="e.g. Poland"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                  />
                </div>
                <div>
                  <Label>{t("plannedRoutesPage.to")}</Label>
                  <Input
                    placeholder="e.g. Spain"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label>{t("plannedRoutesPage.earliestNeeded")}</Label>
                <Input
                  type="date"
                  value={earliestDate}
                  onChange={(e) => setEarliestDate(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                disabled={!origin.trim() || !destination.trim() || mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                {t("plannedRoutesPage.joinWaitlist")}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
