import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PawPrint, ShieldCheck, Clock, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useAuth } from "@/hooks/use-auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export const Route = createFileRoute("/_public/create-breeder")({
  head: () => ({ meta: [{ title: "Apply for verification — Havenpaw" }] }),
  component: CreateBreeder,
});

const orgTypeOptions = [
  { value: "kennel" as const, label: "Breeder kennel" },
  { value: "foundation" as const, label: "Foundation / rescue" },
  { value: "shelter" as const, label: "Shelter" },
];

const schema = z.object({
  orgType: z.enum(["kennel", "foundation", "shelter"]),
  name: z.string().min(1, "Required"),
  city: z.string().min(1, "Required"),
  country: z.string().min(1, "Required"),
  associationName: z.string().optional(),
  membershipNumber: z.string().optional(),
  yearsExperience: z.coerce.number().min(0).optional(),
  breeds: z.string().optional(),
  website: z.string().optional(),
  description: z.string().min(1, "Tell us a little about your kennel or organisation"),
});

type FormValues = z.infer<typeof schema>;

// A "kennel" application is verified as a breeder; foundation/shelter applications share the
// generic "organisation" verification type — see supabase/migrations/*_user_verifications.sql.
function verificationTypeFor(orgType: FormValues["orgType"]) {
  return orgType === "kennel" ? ("breeder" as const) : ("organisation" as const);
}

function CreateBreeder() {
  const { userId, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const verificationQuery = useQuery({
    queryKey: ["my-org-verification", userId],
    enabled: !!userId,
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("user_verifications")
        .select("id, verification_type, status, submitted_data, notes, created_at")
        .eq("user_id", userId!)
        .in("verification_type", ["breeder", "organisation"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      orgType: "kennel",
      name: "",
      city: "",
      country: "",
      associationName: "",
      membershipNumber: "",
      yearsExperience: undefined,
      breeds: "",
      website: "",
      description: "",
    },
  });

  async function onSubmit(values: FormValues) {
    if (!userId) return;
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.from("user_verifications").insert({
      user_id: userId,
      verification_type: verificationTypeFor(values.orgType),
      status: "pending",
      submitted_data: {
        org_type: values.orgType,
        name: values.name,
        description: values.description,
        city: values.city,
        country: values.country,
        public_location: `${values.city}, ${values.country}`,
        association_name: values.associationName || null,
        membership_number: values.membershipNumber || null,
        years_experience: values.yearsExperience ?? null,
        website: values.website || null,
        breeds: values.breeds
          ? values.breeds
              .split(",")
              .map((b) => b.trim())
              .filter(Boolean)
          : [],
      },
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Application submitted for review.");
    queryClient.invalidateQueries({ queryKey: ["my-org-verification", userId] });
  }

  if (authLoading || (userId && verificationQuery.isLoading)) {
    return <div className="container-page py-24 text-center text-muted-foreground">Loading…</div>;
  }

  if (!userId) {
    return (
      <div className="container-page grid min-h-[60vh] place-items-center py-16 text-center">
        <div className="max-w-md">
          <PawPrint className="mx-auto size-8 text-primary" />
          <h1 className="mt-4 font-display text-3xl font-medium">Create an account first</h1>
          <p className="mt-2 text-muted-foreground">
            To apply as a breeder or foundation, first create a Havenpaw account — you'll be brought
            straight back here to submit your application.
          </p>
          <Button asChild size="lg" className="mt-6">
            <Link to="/signup">Create an account</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (verificationQuery.isError) {
    return (
      <div className="container-page grid min-h-[60vh] place-items-center py-16 text-center">
        <div className="max-w-md">
          <XCircle className="mx-auto size-8 text-destructive" />
          <h1 className="mt-4 font-display text-2xl font-medium">
            Couldn't check your application
          </h1>
          <p className="mt-2 text-muted-foreground">
            We couldn't tell whether you've already applied — this isn't the same as not having
            applied, so we didn't show the form to avoid a duplicate submission. Please try again.
          </p>
          <Button variant="outline" className="mt-6" onClick={() => verificationQuery.refetch()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const verification = verificationQuery.data;

  if (verification) {
    const submittedName =
      (verification.submitted_data as { name?: string } | null)?.name ?? "Your application";
    return (
      <div className="container-page py-14">
        <div className="mx-auto max-w-xl rounded-3xl border border-border/70 bg-card p-8 text-center">
          <StatusIcon status={verification.status} />
          <h1 className="mt-4 font-display text-2xl font-medium">{submittedName}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {statusCopy[verification.status] ?? verification.status}
          </p>
          {verification.status === "approved" && (
            <Button asChild size="lg" className="mt-6">
              <Link to="/dashboard/breeder">Go to your dashboard</Link>
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="container-page py-14">
      <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-accent">
            Verification application
          </p>
          <h1 className="mt-1 font-display text-4xl font-medium">
            Apply as a breeder or foundation
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Publish litters, puppies or adoption listings once your kennel or organisation is
            verified. Verification typically takes 2–5 working days.
          </p>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 space-y-6">
              <Section title="Type of application">
                <div className="grid gap-2 md:grid-cols-3">
                  {orgTypeOptions.map((opt) => (
                    <button
                      type="button"
                      key={opt.value}
                      onClick={() => form.setValue("orgType", opt.value)}
                      aria-pressed={form.watch("orgType") === opt.value}
                      className={`rounded-xl border p-3 text-sm font-medium transition-colors ${
                        form.watch("orgType") === opt.value
                          ? "border-primary bg-primary/5"
                          : "border-border bg-background hover:bg-secondary/50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </Section>

              <Section title="Organisation">
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Kennel / organisation name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="yearsExperience"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Years of experience</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </Section>

              <Section title="Association & breeds">
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="associationName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Kennel club / association</FormLabel>
                        <FormControl>
                          <Input placeholder="ZKwP / FCI" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="membershipNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Membership number</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="breeds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Breeds you work with (comma separated)</FormLabel>
                      <FormControl>
                        <Input placeholder="Golden Retriever, Labrador Retriever" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website (optional)</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </Section>

              <Section title="About">
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Short description</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={5}
                          placeholder="Share your breeding philosophy, how puppies are raised, or your organisation's mission."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </Section>

              <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Submitting…" : "Submit for verification"}
              </Button>
            </form>
          </Form>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-border/70 bg-card p-6">
            <div className="flex items-center gap-2 text-primary">
              <ShieldCheck className="size-5" />
              <span className="text-sm font-semibold">What verification checks</span>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>· Owner or organisation identity</li>
              <li>· Registration / association membership</li>
              <li>· Reference from vet or association where relevant</li>
              <li>· Sample health or intake records</li>
            </ul>
            <div className="mt-6 rounded-xl border border-border/70 bg-secondary/50 p-4">
              <div className="flex items-center gap-2">
                <PawPrint className="size-4 text-primary" />
                <span className="text-sm font-semibold">Free to publish</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                We take a small fee only when a reservation goes through. No listing fees, no ads.
              </p>
            </div>
          </div>
        </aside>
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

const statusCopy: Record<string, string> = {
  not_started: "Your application is saved as a draft.",
  pending: "Your application is waiting for review. This usually takes 2–5 working days.",
  more_information_required:
    "We need a bit more information before we can review this application.",
  approved: "Your application has been approved — your public profile is now live.",
  rejected: "Your application was not approved. Contact us for details.",
  suspended: "Your organisation's verification has been suspended. Contact us for details.",
  expired: "Your application has expired — please submit a new one.",
};

function StatusIcon({ status }: { status: string }) {
  if (status === "approved") return <CheckCircle2 className="mx-auto size-8 text-success" />;
  if (status === "rejected" || status === "suspended")
    return <XCircle className="mx-auto size-8 text-destructive" />;
  return <Clock className="mx-auto size-8 text-accent" />;
}
