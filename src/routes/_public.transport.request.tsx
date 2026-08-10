import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Controller, useForm, type Control, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Truck, Check, ArrowLeft, ArrowRight, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/use-auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getFriendlyErrorMessage } from "@/lib/errors";
import {
  classifyComplianceResult,
  createTransportRequest,
  estimatePriceRange,
  findActiveTransportRequestForAnimal,
  findLikelyRouteMatch,
  saveDraft,
} from "@/lib/queries/transport";
import { getPuppyById } from "@/lib/queries/marketplace";

export const Route = createFileRoute("/_public/transport/request")({
  head: () => ({ meta: [{ title: "Request transport — Anemalo" }] }),
  component: TransportRequestPage,
});

const purposeOptions = [
  ["own_dog", "Transport of my own dog"],
  ["purchased_puppy", "Transport of a purchased puppy"],
  ["planned_sale", "Transport related to a planned sale"],
  ["adoption", "Transport after adoption"],
  ["foundation_rescue", "Foundation or rescue transport"],
  ["relocation", "Relocation to a new home"],
  ["exhibition", "Transport to an exhibition"],
  ["veterinary", "Veterinary-related transport"],
  ["other", "Other"],
] as const;

const schema = z.object({
  requestPurpose: z.enum([
    "own_dog",
    "purchased_puppy",
    "planned_sale",
    "adoption",
    "foundation_rescue",
    "relocation",
    "exhibition",
    "veterinary",
    "other",
  ]),
  ownershipChanging: z.boolean(),

  animalName: z.string().min(1, "Required"),
  breedFreeText: z.string().min(1, "Required"),
  sex: z.enum(["male", "female"]),
  approximateAge: z.string().optional(),
  weightKg: z.coerce.number().optional(),
  sizeCategory: z.enum(["small", "medium", "large", "giant"]),
  microchipKnown: z.boolean(),
  microchipNumber: z.string().optional(),
  passportAvailable: z.boolean(),
  vaccinationStatus: z.string().optional(),
  rabiesVaccinationDate: z.string().optional(),
  healthCondition: z.string().optional(),
  medication: z.string().optional(),
  behaviouralNotes: z.string().optional(),
  anxietyOrAggressionNotes: z.string().optional(),
  canTravelWithOthers: z.boolean(),
  crateRequirements: z.string().optional(),

  isCurrentOwner: z.boolean(),
  releaseAuthorizedBy: z.string().optional(),
  receiveAuthorizedBy: z.string().optional(),

  pickupCountry: z.string().min(1, "Required"),
  pickupCity: z.string().min(1, "Required"),
  pickupAreaApprox: z.string().optional(),
  pickupAddressExact: z.string().optional(),
  destinationCountry: z.string().min(1, "Required"),
  destinationCity: z.string().min(1, "Required"),
  destinationAreaApprox: z.string().optional(),
  destinationAddressExact: z.string().optional(),
  earliestDate: z.string().min(1, "Required"),
  latestDate: z.string().optional(),
  flexibleDates: z.boolean(),
  deliveryType: z.enum(["home_delivery", "meeting_point"]),
  numberOfAnimals: z.coerce.number().min(1),

  isDomestic: z.boolean(),
  isSale: z.boolean(),
  isOwnershipChange: z.boolean(),
  isAdoption: z.boolean(),
  travellingWithOwner: z.boolean(),
  ownerTravelWithin5Days: z.boolean(),
  senderIsRegisteredBreeder: z.boolean(),
  senderIsVerifiedOrg: z.boolean(),
  originRegisteredOrApproved: z.boolean(),
  hasPassport: z.boolean(),
  hasMicrochip: z.boolean(),
  rabiesValid: z.boolean(),
  healthCertificateRequired: z.boolean(),
  tracesNotificationRequired: z.boolean(),
  destinationTreatmentRequired: z.boolean(),
  medicallyFitForTransport: z.boolean(),

  requestedServiceType: z.enum(["shared", "individual", "express", "vip", "recommend_best"]),

  message: z.string().optional(),
  confirmedAccurate: z.boolean().refine((v) => v, "Required"),
  confirmedAuthority: z.boolean().refine((v) => v, "Required"),
  confirmedWillProvideDocuments: z.boolean().refine((v) => v, "Required"),
  confirmedUnderstandsReview: z.boolean().refine((v) => v, "Required"),
  confirmedUnderstandsPublicationNotConfirmation: z.boolean().refine((v) => v, "Required"),
});

type FormValues = z.infer<typeof schema>;

const stepFields: (keyof FormValues)[][] = [
  ["requestPurpose", "ownershipChanging"],
  [
    "animalName",
    "breedFreeText",
    "sex",
    "sizeCategory",
    "microchipKnown",
    "passportAvailable",
    "canTravelWithOthers",
  ],
  ["isCurrentOwner"],
  [
    "pickupCountry",
    "pickupCity",
    "destinationCountry",
    "destinationCity",
    "earliestDate",
    "deliveryType",
    "numberOfAnimals",
  ],
  [
    "isDomestic",
    "isSale",
    "isOwnershipChange",
    "isAdoption",
    "travellingWithOwner",
    "ownerTravelWithin5Days",
    "senderIsRegisteredBreeder",
    "senderIsVerifiedOrg",
    "originRegisteredOrApproved",
    "hasPassport",
    "hasMicrochip",
    "rabiesValid",
    "healthCertificateRequired",
    "tracesNotificationRequired",
    "destinationTreatmentRequired",
    "medicallyFitForTransport",
  ],
  ["requestedServiceType"],
  [
    "confirmedAccurate",
    "confirmedAuthority",
    "confirmedWillProvideDocuments",
    "confirmedUnderstandsReview",
    "confirmedUnderstandsPublicationNotConfirmation",
  ],
];

const steps = [
  "Request type",
  "Animal information",
  "Parties involved",
  "Route",
  "Legal & document classification",
  "Service & quotation",
  "Summary & declarations",
];

// Shared by both the final submit (status "submitted") and "Save draft" (status "draft") — a
// draft is deliberately allowed to carry incomplete/invalid data (required-field validation only
// applies at final submit, via the zod schema + form.trigger on each step).
function buildTransportRequestPayload(
  values: FormValues,
  userId: string,
  status: "submitted" | "draft",
  id?: string,
  animalId?: string | null,
  senderOrgId?: string | null,
) {
  const complianceReviewResult = classifyComplianceResult({
    isDomestic: values.isDomestic,
    isSale: values.isSale,
    isOwnershipChange: values.isOwnershipChange,
    hasMicrochip: values.hasMicrochip,
    hasPassport: values.hasPassport,
    medicallyFitForTransport: values.medicallyFitForTransport,
    healthCertificateRequired: values.healthCertificateRequired,
  });

  return {
    ...(id ? { id } : {}),
    requester_profile_id: userId,
    request_purpose: values.requestPurpose,
    ownership_changing: values.ownershipChanging,
    animal_id: animalId || null,
    sender_org_id: senderOrgId || null,
    animal_name: values.animalName || null,
    breed_free_text: values.breedFreeText || null,
    sex: values.sex,
    approximate_age: values.approximateAge || null,
    weight_kg: values.weightKg ?? null,
    size_category: values.sizeCategory,
    microchip_known: values.microchipKnown,
    microchip_number: values.microchipNumber || null,
    passport_available: values.passportAvailable,
    vaccination_status: values.vaccinationStatus || null,
    rabies_vaccination_date: values.rabiesVaccinationDate || null,
    health_condition: values.healthCondition || null,
    medication: values.medication || null,
    behavioural_notes: values.behaviouralNotes || null,
    anxiety_or_aggression_notes: values.anxietyOrAggressionNotes || null,
    can_travel_with_others: values.canTravelWithOthers,
    crate_requirements: values.crateRequirements || null,
    current_owner_profile_id: values.isCurrentOwner ? userId : null,
    release_authorized_by: values.releaseAuthorizedBy || null,
    receive_authorized_by: values.receiveAuthorizedBy || null,
    pickup_country: values.pickupCountry || null,
    pickup_city: values.pickupCity || null,
    pickup_area_approx: values.pickupAreaApprox || null,
    pickup_address_exact: values.pickupAddressExact || null,
    destination_country: values.destinationCountry || null,
    destination_city: values.destinationCity || null,
    destination_area_approx: values.destinationAreaApprox || null,
    destination_address_exact: values.destinationAddressExact || null,
    earliest_date: values.earliestDate || null,
    latest_date: values.latestDate || null,
    flexible_dates: values.flexibleDates,
    delivery_type: values.deliveryType,
    number_of_animals: values.numberOfAnimals || 1,
    is_domestic: values.isDomestic,
    is_sale: values.isSale,
    is_ownership_change: values.isOwnershipChange,
    is_adoption: values.isAdoption,
    travelling_with_owner: values.travellingWithOwner,
    owner_travel_within_5_days: values.ownerTravelWithin5Days,
    sender_is_registered_breeder: values.senderIsRegisteredBreeder,
    sender_is_verified_org: values.senderIsVerifiedOrg,
    origin_registered_or_approved: values.originRegisteredOrApproved,
    has_passport: values.hasPassport,
    has_microchip: values.hasMicrochip,
    rabies_valid: values.rabiesValid,
    health_certificate_required: values.healthCertificateRequired,
    traces_notification_required: values.tracesNotificationRequired,
    destination_treatment_required: values.destinationTreatmentRequired,
    medically_fit_for_transport: values.medicallyFitForTransport,
    compliance_review_result: complianceReviewResult,
    requested_service_type: values.requestedServiceType,
    confirmed_accurate: values.confirmedAccurate,
    confirmed_authority: values.confirmedAuthority,
    confirmed_will_provide_documents: values.confirmedWillProvideDocuments,
    confirmed_understands_review: values.confirmedUnderstandsReview,
    confirmed_understands_publication_not_confirmation:
      values.confirmedUnderstandsPublicationNotConfirmation,
    status,
    visibility: "private" as const,
  };
}

// Reverse mapping for resuming a saved draft — falls back to the form's current defaults for any
// column that came back null, so the form never ends up with an invalid enum value.
function mapRowToFormValues(row: Record<string, unknown>, current: FormValues): FormValues {
  const pick = <T,>(key: string, fallback: T): T => (row[key] ?? fallback) as T;
  return {
    ...current,
    requestPurpose: pick("request_purpose", current.requestPurpose),
    ownershipChanging: pick("ownership_changing", current.ownershipChanging),
    animalName: pick("animal_name", ""),
    breedFreeText: pick("breed_free_text", ""),
    sex: pick("sex", current.sex),
    approximateAge: pick("approximate_age", ""),
    weightKg: pick("weight_kg", undefined),
    sizeCategory: pick("size_category", current.sizeCategory),
    microchipKnown: pick("microchip_known", current.microchipKnown),
    microchipNumber: pick("microchip_number", ""),
    passportAvailable: pick("passport_available", current.passportAvailable),
    vaccinationStatus: pick("vaccination_status", ""),
    rabiesVaccinationDate: pick("rabies_vaccination_date", ""),
    healthCondition: pick("health_condition", ""),
    medication: pick("medication", ""),
    behaviouralNotes: pick("behavioural_notes", ""),
    anxietyOrAggressionNotes: pick("anxiety_or_aggression_notes", ""),
    canTravelWithOthers: pick("can_travel_with_others", current.canTravelWithOthers),
    crateRequirements: pick("crate_requirements", ""),
    isCurrentOwner: row.current_owner_profile_id != null,
    releaseAuthorizedBy: pick("release_authorized_by", ""),
    receiveAuthorizedBy: pick("receive_authorized_by", ""),
    pickupCountry: pick("pickup_country", ""),
    pickupCity: pick("pickup_city", ""),
    pickupAreaApprox: pick("pickup_area_approx", ""),
    pickupAddressExact: pick("pickup_address_exact", ""),
    destinationCountry: pick("destination_country", ""),
    destinationCity: pick("destination_city", ""),
    destinationAreaApprox: pick("destination_area_approx", ""),
    destinationAddressExact: pick("destination_address_exact", ""),
    earliestDate: pick("earliest_date", ""),
    latestDate: pick("latest_date", ""),
    flexibleDates: pick("flexible_dates", current.flexibleDates),
    deliveryType: pick("delivery_type", current.deliveryType),
    numberOfAnimals: pick("number_of_animals", 1),
    isDomestic: pick("is_domestic", current.isDomestic),
    isSale: pick("is_sale", current.isSale),
    isOwnershipChange: pick("is_ownership_change", current.isOwnershipChange),
    isAdoption: pick("is_adoption", current.isAdoption),
    travellingWithOwner: pick("travelling_with_owner", current.travellingWithOwner),
    ownerTravelWithin5Days: pick("owner_travel_within_5_days", current.ownerTravelWithin5Days),
    senderIsRegisteredBreeder: pick(
      "sender_is_registered_breeder",
      current.senderIsRegisteredBreeder,
    ),
    senderIsVerifiedOrg: pick("sender_is_verified_org", current.senderIsVerifiedOrg),
    originRegisteredOrApproved: pick(
      "origin_registered_or_approved",
      current.originRegisteredOrApproved,
    ),
    hasPassport: pick("has_passport", current.hasPassport),
    hasMicrochip: pick("has_microchip", current.hasMicrochip),
    rabiesValid: pick("rabies_valid", current.rabiesValid),
    healthCertificateRequired: pick(
      "health_certificate_required",
      current.healthCertificateRequired,
    ),
    tracesNotificationRequired: pick(
      "traces_notification_required",
      current.tracesNotificationRequired,
    ),
    destinationTreatmentRequired: pick(
      "destination_treatment_required",
      current.destinationTreatmentRequired,
    ),
    medicallyFitForTransport: pick("medically_fit_for_transport", current.medicallyFitForTransport),
    requestedServiceType: pick("requested_service_type", current.requestedServiceType),
  };
}

function TransportRequestPage() {
  const { userId, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<{ requestNumber: string; status: string } | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [animalId, setAnimalId] = useState<string | null>(null);
  const [senderOrgId, setSenderOrgId] = useState<string | null>(null);
  const [linkedAnimal, setLinkedAnimal] = useState<{ name: string; kennel: string } | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<{ requestNumber: string } | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      requestPurpose: "own_dog",
      ownershipChanging: false,
      sex: "male",
      sizeCategory: "medium",
      microchipKnown: true,
      passportAvailable: true,
      canTravelWithOthers: true,
      isCurrentOwner: true,
      flexibleDates: false,
      deliveryType: "meeting_point",
      numberOfAnimals: 1,
      isDomestic: true,
      isSale: false,
      isOwnershipChange: false,
      isAdoption: false,
      travellingWithOwner: false,
      ownerTravelWithin5Days: false,
      senderIsRegisteredBreeder: false,
      senderIsVerifiedOrg: false,
      originRegisteredOrApproved: false,
      hasPassport: true,
      hasMicrochip: true,
      rabiesValid: true,
      healthCertificateRequired: false,
      tracesNotificationRequired: false,
      destinationTreatmentRequired: false,
      medicallyFitForTransport: true,
      requestedServiceType: "recommend_best",
      confirmedAccurate: false,
      confirmedAuthority: false,
      confirmedWillProvideDocuments: false,
      confirmedUnderstandsReview: false,
      confirmedUnderstandsPublicationNotConfirmation: false,
    },
  });

  // Coming from the no-account-needed /estimate page (?pickupCountry=...&destinationCountry=...
  // &sizeCategory=...&serviceType=...): reuse exactly what was already entered there instead of
  // making the visitor retype it — deliberately NOT gated on userId, since /estimate is usable
  // signed out and "Continue with full request" can be the very next click.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pickupCountry = params.get("pickupCountry");
    const destinationCountry = params.get("destinationCountry");
    const sizeCategory = params.get("sizeCategory");
    const serviceType = params.get("serviceType");
    if (pickupCountry) form.setValue("pickupCountry", pickupCountry);
    if (destinationCountry) form.setValue("destinationCountry", destinationCountry);
    if (sizeCategory) form.setValue("sizeCategory", sizeCategory as FormValues["sizeCategory"]);
    if (serviceType)
      form.setValue("requestedServiceType", serviceType as FormValues["requestedServiceType"]);
    // Deliberately runs once on mount only (reads the URL's initial query params) — matches the
    // same established pattern as adoption-form-dialog.tsx/puppy-form-dialog.tsx etc.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sensible defaults: prefill from context so the customer doesn't re-type what we already know.
  // Coming from a puppy listing (/transport/request?animalId=...): the animal, purpose and pickup
  // location (the breeder's location) come from the listing; the customer's own profile fills in
  // the destination, since that's where they'll receive the puppy. Otherwise (no linked animal —
  // e.g. transporting their own dog) the customer's profile fills the pickup location instead.
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const supabase = getSupabaseBrowserClient();
      const id = new URLSearchParams(window.location.search).get("animalId");
      if (id) {
        setAnimalId(id);
        try {
          const puppy = await getPuppyById(id);
          if (puppy.breederId) setSenderOrgId(puppy.breederId);
          const { data: ownedOrg } = await supabase
            .from("organisations")
            .select("id")
            .eq("id", puppy.breederId)
            .eq("owner_user_id", userId)
            .maybeSingle();
          const submittingAsBreeder = !!ownedOrg;

          form.setValue("requestPurpose", "purchased_puppy");
          form.setValue("isOwnershipChange", true);
          form.setValue("isSale", true);
          form.setValue("isCurrentOwner", submittingAsBreeder);
          form.setValue("animalName", puppy.name);
          form.setValue("breedFreeText", puppy.breed);
          form.setValue("sex", puppy.sex === "Female" ? "female" : "male");
          if (puppy.city) form.setValue("pickupCity", puppy.city);
          if (puppy.country) form.setValue("pickupCountry", puppy.country);
          form.setValue("senderIsRegisteredBreeder", true);
          form.setValue("senderIsVerifiedOrg", puppy.verified);
          form.setValue("originRegisteredOrApproved", puppy.verified);
          setLinkedAnimal({ name: puppy.name, kennel: puppy.kennel });

          const duplicate = await findActiveTransportRequestForAnimal(userId, id);
          if (duplicate) setDuplicateWarning({ requestNumber: duplicate.request_number ?? "" });

          // Only fill the destination from "my profile" when the buyer themselves is submitting —
          // a breeder submitting on the buyer's behalf doesn't have the buyer's home address to
          // reuse here, so that field is left for the breeder to fill in with what the buyer told
          // them (never auto-filled from unrelated private data).
          if (!submittingAsBreeder) {
            const { data } = await supabase
              .from("profiles")
              .select("city, country")
              .eq("id", userId)
              .maybeSingle();
            if (data?.city && !form.getValues("destinationCity"))
              form.setValue("destinationCity", data.city);
            if (data?.country && !form.getValues("destinationCountry"))
              form.setValue("destinationCountry", data.country);
          }
        } catch {
          // Listing no longer available — leave the form for manual entry.
        }
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("city, country")
        .eq("id", userId)
        .maybeSingle();
      if (data?.city && !form.getValues("pickupCity")) form.setValue("pickupCity", data.city);
      if (data?.country && !form.getValues("pickupCountry"))
        form.setValue("pickupCountry", data.country);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Resume a saved draft from /transport/request?draft=<id> — "save progress automatically and
  // allow the user to resume later."
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("draft");
    if (!id || !userId) return;
    (async () => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("transport_requests")
        .select("*")
        .eq("id", id)
        .eq("status", "draft")
        .maybeSingle();
      if (error || !data) return;
      setDraftId(data.id);
      if (data.animal_id) {
        setAnimalId(data.animal_id);
        if (data.sender_org_id) setSenderOrgId(data.sender_org_id);
        getPuppyById(data.animal_id)
          .then((puppy) => setLinkedAnimal({ name: puppy.name, kennel: puppy.kennel }))
          .catch(() => {});
      }
      form.reset(mapRowToFormValues(data, form.getValues()));
      toast.info("Resumed your draft.");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function handleSaveDraft() {
    if (!userId) return;
    setSavingDraft(true);
    try {
      const values = form.getValues();
      const saved = await saveDraft(
        buildTransportRequestPayload(
          values,
          userId,
          "draft",
          draftId ?? undefined,
          animalId,
          senderOrgId,
        ),
      );
      setDraftId(saved.id);
      toast.success("Draft saved — resume it any time from your dashboard.");
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err, "Could not save the draft."));
    } finally {
      setSavingDraft(false);
    }
  }

  async function goNext() {
    const valid = await form.trigger(stepFields[step]);
    if (!valid) return;
    if (step < steps.length - 1) setStep(step + 1);
  }

  async function onSubmit(values: FormValues) {
    if (!userId) return;
    try {
      const created = await createTransportRequest(
        buildTransportRequestPayload(
          values,
          userId,
          "submitted",
          draftId ?? undefined,
          animalId,
          senderOrgId,
        ),
      );
      // submit_transport_request() updates the existing draft row in place (draft -> submitted)
      // when a draft id is passed, so there is no separate row left behind to clean up here.
      setResult({ requestNumber: created.request_number ?? "", status: created.status });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err, "Could not submit the request."));
    }
  }

  if (authLoading) {
    return <div className="container-page py-24 text-center text-muted-foreground">Loading…</div>;
  }

  if (!userId) {
    return (
      <div className="container-page grid min-h-[60vh] place-items-center py-16 text-center">
        <div className="max-w-md">
          <Truck className="mx-auto size-8 text-primary" />
          <h1 className="mt-4 font-display text-3xl font-medium">Sign in to request transport</h1>
          <p className="mt-2 text-muted-foreground">
            Create a free account to submit and track a transport request.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button asChild size="lg">
              <Link to="/signup">Create an account</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/signin">Sign in</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (result) {
    return <SubmittedSummary requestNumber={result.requestNumber} formValues={form.getValues()} />;
  }

  return (
    <div className="container-page py-10">
      <header className="mb-8">
        <p className="text-xs font-medium uppercase tracking-wider text-accent">
          Transport request
        </p>
        <h1 className="mt-1 font-display text-4xl font-medium">Plan a safe journey for your dog</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Step {step + 1} of {steps.length}: {steps[step]}
        </p>
        <Progress value={((step + 1) / steps.length) * 100} className="mt-4 max-w-2xl" />

        {linkedAnimal && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              Requesting transport for <strong>{linkedAnimal.name}</strong> from{" "}
              <strong>{linkedAnimal.kennel}</strong>. We've pre-filled what we know — please confirm
              the exact pickup and destination details below.
            </span>
          </div>
        )}
        {duplicateWarning && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
            <Info className="mt-0.5 size-4 shrink-0 text-warning" />
            <span>
              You already have an open transport request ({duplicateWarning.requestNumber}) for this
              animal. You can still submit a new one, but check your{" "}
              <Link to="/dashboard/buyer/transport" className="underline">
                existing requests
              </Link>{" "}
              first to avoid duplicates.
            </span>
          </div>
        )}
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (step === steps.length - 1) form.handleSubmit(onSubmit)();
          else goNext();
        }}
        className="grid gap-8 lg:grid-cols-[1fr_320px]"
      >
        <div className="space-y-6">
          {step === 0 && <Step1 form={form} />}
          {step === 1 && <Step2 form={form} />}
          {step === 2 && <Step3 form={form} />}
          {step === 3 && <Step4 form={form} />}
          {step === 4 && <Step5 form={form} />}
          {step === 5 && <Step6 form={form} />}
          {step === 6 && <Step7 form={form} />}

          <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-card p-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0}
            >
              <ArrowLeft className="mr-1 size-4" /> Back
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleSaveDraft}
                disabled={savingDraft}
              >
                {savingDraft ? "Saving…" : "Save draft"}
              </Button>
              {step < steps.length - 1 ? (
                <Button type="submit">
                  Continue <ArrowRight className="ml-1 size-4" />
                </Button>
              ) : (
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Submitting…" : "Submit request"}
                </Button>
              )}
            </div>
          </div>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-border/70 bg-card p-6">
            <h3 className="font-display text-lg font-semibold">What happens next</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>· Operations reviews the animal and document information</li>
              <li>· A quotation is prepared for your chosen service category</li>
              <li>· Pickup and route are scheduled once accepted</li>
            </ul>
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-border/70 bg-secondary/50 p-3 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Submitting a request does not guarantee transport or a fixed price. Final
                eligibility and pricing are confirmed after review.
              </span>
            </div>
          </div>
        </aside>
      </form>
    </div>
  );
}

// Post-submission summary: status, what's still missing, whether a route may already match, an
// indicative price range, and the next action — never a guarantee, always "subject to review."
function SubmittedSummary({
  requestNumber,
  formValues,
}: {
  requestNumber: string;
  formValues: FormValues;
}) {
  const routeMatchQuery = useQuery({
    queryKey: ["likely-route-match", formValues.destinationCountry],
    queryFn: () => findLikelyRouteMatch(formValues.destinationCountry),
  });
  const [priceLow, priceHigh] = estimatePriceRange(formValues.requestedServiceType);
  const missing: string[] = [];
  if (!formValues.microchipKnown) missing.push("Microchip number");
  if (!formValues.passportAvailable) missing.push("Animal passport");
  if (!formValues.pickupAddressExact) missing.push("Exact pickup address");
  if (!formValues.destinationAddressExact) missing.push("Exact destination address");

  return (
    <div className="container-page py-10">
      <div className="rounded-3xl border border-border/70 bg-card p-8">
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-success/15 text-success">
          <Check className="size-7" />
        </div>
        <h2 className="mt-4 text-center font-display text-2xl font-medium">
          Transport request submitted
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-center text-sm text-muted-foreground">
          Your reference number is <strong>{requestNumber}</strong>. Submitting a request does not
          confirm transport — our operations team reviews the details and documents before preparing
          a quotation.
        </p>

        <div className="mx-auto mt-6 grid max-w-lg gap-3">
          <div className="rounded-xl border border-border/70 bg-background p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Estimated price range
            </div>
            <div className="mt-1 font-display text-xl font-semibold">
              €{priceLow} – €{priceHigh}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Indicative only, based on your selected service — not a confirmed quotation.
            </p>
          </div>

          {routeMatchQuery.data && (
            <div className="rounded-xl border border-border/70 bg-background p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Possible route match
              </div>
              <p className="mt-1 text-sm">
                A planned route ("{routeMatchQuery.data.route_name}") already heads toward{" "}
                {formValues.destinationCountry} — operations will confirm whether it can include
                you.
              </p>
            </div>
          )}

          {missing.length > 0 && (
            <div className="rounded-xl border border-border/70 bg-background p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Still needed
              </div>
              <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                {missing.map((m) => (
                  <li key={m}>· {m}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-xl border border-border/70 bg-background p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Next action</div>
            <p className="mt-1 text-sm">
              Sit tight — operations will review your request and be in touch.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-center gap-2">
          <Button asChild size="lg">
            <Link to="/dashboard/buyer">View in your dashboard</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/">Back to home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-6 space-y-4">
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {children}
    </section>
  );
}
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
function YesNo({
  control,
  name,
  label,
}: {
  control: Control<FormValues>;
  name: keyof FormValues;
  label: string;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <label className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
          <span>{label}</span>
          <Checkbox checked={!!field.value} onCheckedChange={field.onChange} />
        </label>
      )}
    />
  );
}

function Step1({ form }: { form: UseFormReturn<FormValues> }) {
  return (
    <Section title="What does this request concern?">
      <Controller
        control={form.control}
        name="requestPurpose"
        render={({ field }) => (
          <RadioGroup
            value={field.value}
            onValueChange={field.onChange}
            className="grid gap-2 md:grid-cols-2"
          >
            {purposeOptions.map(([v, l]) => (
              <label
                key={v}
                className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm"
              >
                <RadioGroupItem value={v} /> {l}
              </label>
            ))}
          </RadioGroup>
        )}
      />
      <YesNo
        control={form.control}
        name="ownershipChanging"
        label="Ownership of the animal will change during or after this journey"
      />
    </Section>
  );
}

function Step2({ form }: { form: UseFormReturn<FormValues> }) {
  const { register, control, formState } = form;
  return (
    <Section title="Animal information">
      <div className="grid gap-4 md:grid-cols-2">
        <F label="Animal name">
          <Input {...register("animalName")} />
          {formState.errors.animalName && (
            <p className="text-xs text-destructive">{formState.errors.animalName.message}</p>
          )}
        </F>
        <F label="Breed or mixed breed">
          <Input {...register("breedFreeText")} />
        </F>
        <F label="Sex">
          <Controller
            control={control}
            name="sex"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </F>
        <F label="Approximate age">
          <Input placeholder="e.g. 2 years" {...register("approximateAge")} />
        </F>
        <F label="Weight (kg)">
          <Input type="number" step="0.1" {...register("weightKg")} />
        </F>
        <F label="Size">
          <Controller
            control={control}
            name="sizeCategory"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Small</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="large">Large</SelectItem>
                  <SelectItem value="giant">Giant</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </F>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <YesNo control={control} name="microchipKnown" label="Microchip number is known" />
        <YesNo control={control} name="passportAvailable" label="Animal passport is available" />
      </div>
      {form.watch("microchipKnown") && (
        <F label="Microchip number">
          <Input {...register("microchipNumber")} />
        </F>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <F label="Vaccination status">
          <Input placeholder="e.g. up to date" {...register("vaccinationStatus")} />
        </F>
        <F label="Rabies vaccination date">
          <Input type="date" {...register("rabiesVaccinationDate")} />
        </F>
      </div>
      <F label="Health condition">
        <Textarea rows={2} {...register("healthCondition")} />
      </F>
      <F label="Current medication">
        <Input {...register("medication")} />
      </F>
      <div className="grid gap-4 md:grid-cols-2">
        <F label="Behavioural information">
          <Textarea rows={2} {...register("behaviouralNotes")} />
        </F>
        <F label="Anxiety or aggression information">
          <Textarea rows={2} {...register("anxietyOrAggressionNotes")} />
        </F>
      </div>
      <YesNo
        control={control}
        name="canTravelWithOthers"
        label="Can travel safely near other animals"
      />
      <F label="Transport crate requirements">
        <Input {...register("crateRequirements")} />
      </F>
    </Section>
  );
}

function Step3({ form }: { form: UseFormReturn<FormValues> }) {
  const { control, register } = form;
  return (
    <Section title="Parties involved">
      <p className="text-sm text-muted-foreground">
        The platform account owner, the legal owner, the sender and the recipient may be different
        people. For now we record what we can verify directly from your account plus free-text notes
        for anyone else involved — a full contact directory is coming in a later update.
      </p>
      <YesNo
        control={control}
        name="isCurrentOwner"
        label="I am the current legal owner of this animal"
      />
      <div className="grid gap-4 md:grid-cols-2">
        <F label="Person authorised to release the animal">
          <Input {...register("releaseAuthorizedBy")} />
        </F>
        <F label="Person authorised to receive the animal">
          <Input {...register("receiveAuthorizedBy")} />
        </F>
      </div>
    </Section>
  );
}

function Step4({ form }: { form: UseFormReturn<FormValues> }) {
  const { register, control, formState } = form;
  return (
    <Section title="Route">
      <div className="grid gap-4 md:grid-cols-2">
        <F label="Pickup country">
          <Input {...register("pickupCountry")} />
        </F>
        <F label="Pickup city">
          <Input {...register("pickupCity")} />
        </F>
        <F label="Approximate pickup area">
          <Input placeholder="e.g. Śródmieście district" {...register("pickupAreaApprox")} />
        </F>
        <F label="Exact pickup address (private — shown only to authorised staff after acceptance)">
          <Input {...register("pickupAddressExact")} />
        </F>
        <F label="Destination country">
          <Input {...register("destinationCountry")} />
        </F>
        <F label="Destination city">
          <Input {...register("destinationCity")} />
        </F>
        <F label="Approximate destination area">
          <Input {...register("destinationAreaApprox")} />
        </F>
        <F label="Exact destination address (private — shown only to authorised staff after acceptance)">
          <Input {...register("destinationAddressExact")} />
        </F>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <F label="Earliest possible date">
          <Input type="date" {...register("earliestDate")} />
          {formState.errors.earliestDate && <p className="text-xs text-destructive">Required</p>}
        </F>
        <F label="Latest acceptable date">
          <Input type="date" {...register("latestDate")} />
        </F>
        <F label="Number of animals">
          <Input type="number" min={1} {...register("numberOfAnimals")} />
        </F>
      </div>
      <YesNo control={control} name="flexibleDates" label="I'm flexible on the exact date" />
      <F label="Delivery preference">
        <Controller
          control={control}
          name="deliveryType"
          render={({ field }) => (
            <RadioGroup
              value={field.value}
              onValueChange={field.onChange}
              className="grid gap-2 md:grid-cols-2"
            >
              <label className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm">
                <RadioGroupItem value="home_delivery" /> Home delivery
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm">
                <RadioGroupItem value="meeting_point" /> Meeting point
              </label>
            </RadioGroup>
          )}
        />
      </F>
    </Section>
  );
}

function Step5({ form }: { form: UseFormReturn<FormValues> }) {
  const { control } = form;
  return (
    <Section title="Legal and document classification">
      <p className="text-sm text-muted-foreground">
        This does not make a final legal decision — it helps our operations team route your request
        to the right review.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <YesNo
          control={control}
          name="isDomestic"
          label="This is a domestic journey (same country)"
        />
        <YesNo control={control} name="isSale" label="The animal is being sold" />
        <YesNo control={control} name="isOwnershipChange" label="Ownership is changing" />
        <YesNo control={control} name="isAdoption" label="This is an adoption" />
        <YesNo
          control={control}
          name="travellingWithOwner"
          label="The animal is travelling with its owner"
        />
        <YesNo
          control={control}
          name="ownerTravelWithin5Days"
          label="Owner will travel within 5 days of the animal"
        />
        <YesNo
          control={control}
          name="senderIsRegisteredBreeder"
          label="Sender is a registered breeder"
        />
        <YesNo
          control={control}
          name="senderIsVerifiedOrg"
          label="Sender is a verified foundation, shelter or rescue"
        />
        <YesNo
          control={control}
          name="originRegisteredOrApproved"
          label="Place of origin is registered/approved where required"
        />
        <YesNo control={control} name="hasPassport" label="Animal has a passport" />
        <YesNo control={control} name="hasMicrochip" label="Animal has a microchip" />
        <YesNo control={control} name="rabiesValid" label="Rabies vaccination is valid" />
        <YesNo
          control={control}
          name="healthCertificateRequired"
          label="A health certificate is required"
        />
        <YesNo
          control={control}
          name="tracesNotificationRequired"
          label="A TRACES notification is required"
        />
        <YesNo
          control={control}
          name="destinationTreatmentRequired"
          label="Destination-specific treatment is required"
        />
        <YesNo
          control={control}
          name="medicallyFitForTransport"
          label="Animal is medically fit for transport"
        />
      </div>
    </Section>
  );
}

const serviceOptions = [
  ["shared", "Shared", "Flexible dates, lower price, planned European routes."],
  ["individual", "Individual", "Dedicated planning, direct pickup and handover."],
  ["express", "Express", "Priority quotation, earliest available departure."],
  ["vip", "VIP", "Dedicated scheduling, premium communication, extra updates."],
  ["recommend_best", "Recommend the best option", "Let our operations team suggest the best fit."],
] as const;

function Step6({ form }: { form: UseFormReturn<FormValues> }) {
  return (
    <Section title="Service and quotation">
      <Controller
        control={form.control}
        name="requestedServiceType"
        render={({ field }) => (
          <RadioGroup
            value={field.value}
            onValueChange={field.onChange}
            className="grid gap-2 md:grid-cols-2"
          >
            {serviceOptions.map(([v, title, desc]) => (
              <label
                key={v}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background p-4 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
              >
                <RadioGroupItem value={v} className="mt-0.5" />
                <div>
                  <div className="text-sm font-medium">{title}</div>
                  <div className="text-xs text-muted-foreground">{desc}</div>
                </div>
              </label>
            ))}
          </RadioGroup>
        )}
      />
      <div className="flex items-start gap-2 rounded-xl border border-border/70 bg-secondary/50 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span>
          The final service type and price are confirmed after route and document review — not
          guaranteed here.
        </span>
      </div>
    </Section>
  );
}

function Step7({ form }: { form: UseFormReturn<FormValues> }) {
  const { control, register } = form;
  const v = form.watch();
  return (
    <>
      <Section title="Message (optional)">
        <Textarea
          rows={4}
          placeholder="Anything else our operations team should know?"
          {...register("message")}
        />
      </Section>
      <Section title="Summary">
        <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
          <SummaryItem label="Animal" value={v.animalName} />
          <SummaryItem label="Breed" value={v.breedFreeText} />
          <SummaryItem
            label="Route"
            value={`${v.pickupCity ?? "?"} → ${v.destinationCity ?? "?"}`}
          />
          <SummaryItem label="Earliest date" value={v.earliestDate} />
          <SummaryItem
            label="Service"
            value={serviceOptions.find((s) => s[0] === v.requestedServiceType)?.[1]}
          />
          <SummaryItem
            label="Purpose"
            value={purposeOptions.find((p) => p[0] === v.requestPurpose)?.[1]}
          />
        </dl>
      </Section>
      <Section title="Declarations">
        <Confirm
          control={control}
          name="confirmedAccurate"
          label="The information I have provided is accurate."
        />
        <Confirm
          control={control}
          name="confirmedAuthority"
          label="I have the authority to request this transport."
        />
        <Confirm
          control={control}
          name="confirmedWillProvideDocuments"
          label="I understand I will need to provide the required documents."
        />
        <Confirm
          control={control}
          name="confirmedUnderstandsReview"
          label="I understand acceptance depends on document and animal-fitness review."
        />
        <Confirm
          control={control}
          name="confirmedUnderstandsPublicationNotConfirmation"
          label="I understand submitting this request is not confirmation of transport."
        />
      </Section>
    </>
  );
}

function SummaryItem({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value || "—"}</dd>
    </div>
  );
}

function Confirm({
  control,
  name,
  label,
}: {
  control: Control<FormValues>;
  name: keyof FormValues;
  label: string;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <div>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={!!field.value} onCheckedChange={field.onChange} className="mt-0.5" />
            {label}
          </label>
          {fieldState.error && <p className="ml-6 text-xs text-destructive">Required to submit</p>}
        </div>
      )}
    />
  );
}
