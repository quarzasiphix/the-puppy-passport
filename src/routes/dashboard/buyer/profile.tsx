import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Clock, XCircle, AlertCircle } from "lucide-react";
import { getFriendlyErrorMessage } from "@/shared/lib/errors";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Badge } from "@/shared/ui/badge";
import { useAuth } from "@/domains/identity";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { AccountPrivacyCard } from "@/domains/identity";

export const Route = createFileRoute("/dashboard/buyer/profile")({
  component: BuyerProfile,
});

const schema = z.object({
  displayName: z.string().min(1, "Required"),
  phone: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  preferredLanguage: z.enum(["en", "pl"]),
  preferredCurrency: z.enum(["EUR", "PLN"]),
});
type FormValues = z.infer<typeof schema>;

const roleStatusCopy: Record<
  string,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  pending: { label: "Verification pending", icon: Clock, className: "bg-accent/15 text-accent" },
  active: { label: "Active", icon: CheckCircle2, className: "bg-success/15 text-success" },
  suspended: {
    label: "Suspended",
    icon: AlertCircle,
    className: "bg-destructive/10 text-destructive",
  },
  rejected: { label: "Rejected", icon: XCircle, className: "bg-destructive/10 text-destructive" },
};

const roleLabels: Record<string, string> = {
  customer: "Transport customer",
  buyer: "Buyer",
  animal_owner: "Animal owner",
  breeder: "Breeder",
  foundation_member: "Foundation member",
  shelter_member: "Shelter member",
  operations: "Transport operations",
  driver: "Driver",
  moderator: "Moderator",
  admin: "Administrator",
};

function BuyerProfile() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["my-profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient();
      // Own email/phone are excluded from the broad `profiles` column grant (see
      // 20260101003200_profiles_contact_lockdown.sql) — this RPC returns the full row but only
      // ever for the caller's own id, so it can't be used to read anyone else's contact details.
      const { data, error } = await supabase.rpc("get_my_profile");
      if (error) throw error;
      return data;
    },
  });

  const rolesQuery = useQuery({
    queryKey: ["my-roles", userId],
    enabled: !!userId,
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("user_roles")
        .select("role, status")
        .eq("user_id", userId!);
      if (error) throw error;
      return data;
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: profileQuery.data
      ? {
          displayName: profileQuery.data.display_name ?? "",
          phone: profileQuery.data.phone ?? "",
          city: profileQuery.data.city ?? "",
          country: profileQuery.data.country ?? "",
          preferredLanguage: (profileQuery.data.preferred_language as "en" | "pl") ?? "en",
          preferredCurrency: (profileQuery.data.preferred_currency as "EUR" | "PLN") ?? "EUR",
        }
      : undefined,
  });

  async function onSubmit(values: FormValues) {
    if (!userId) return;
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: values.displayName,
        phone: values.phone || null,
        city: values.city || null,
        country: values.country || null,
        preferred_language: values.preferredLanguage,
        preferred_currency: values.preferredCurrency,
      })
      .eq("id", userId);
    if (error) {
      toast.error(getFriendlyErrorMessage(error, "Could not update your profile."));
      return;
    }
    toast.success("Profile updated.");
    queryClient.invalidateQueries({ queryKey: ["my-profile", userId] });
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">Your account</h1>
        <p className="text-sm text-muted-foreground">
          Breeders see your name when reviewing applications.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="max-w-2xl space-y-4 rounded-2xl border border-border/70 bg-card p-6">
          {profileQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="displayName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Display name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input {...field} />
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
                  <FormField
                    control={form.control}
                    name="preferredLanguage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preferred language</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="en">English</SelectItem>
                            <SelectItem value="pl">Polski</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="preferredCurrency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preferred currency</FormLabel>
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
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Saving…" : "Save profile"}
                </Button>
              </form>
            </Form>
          )}
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-6">
          <h2 className="mb-3 font-display text-lg font-semibold">Account status</h2>
          {rolesQuery.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          <ul className="space-y-2">
            {rolesQuery.data?.map((r) => {
              const copy = roleStatusCopy[r.status] ?? roleStatusCopy.pending;
              return (
                <li
                  key={r.role}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/70 p-3 text-sm"
                >
                  <span>{roleLabels[r.role] ?? r.role}</span>
                  <Badge className={copy.className}>
                    <copy.icon className="mr-1 size-3" /> {copy.label}
                  </Badge>
                </li>
              );
            })}
            {rolesQuery.data?.length === 0 && (
              <li className="text-sm text-muted-foreground">No roles yet.</li>
            )}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            A pending breeder or foundation role can still be used to request transport — it just
            can't publish listings until approved.
          </p>
        </div>

        {userId && <AccountPrivacyCard userId={userId} />}
      </div>
    </div>
  );
}
