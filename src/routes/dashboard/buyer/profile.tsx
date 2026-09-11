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
import { useTranslation } from "@/shared/i18n";

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

function getRoleStatusCopy(
  t: (key: string) => string,
): Record<string, { label: string; icon: typeof CheckCircle2; className: string }> {
  return {
    pending: {
      label: t("buyerPanel.profile.roleStatusPending"),
      icon: Clock,
      className: "bg-accent/15 text-accent",
    },
    active: {
      label: t("buyerPanel.profile.roleStatusActive"),
      icon: CheckCircle2,
      className: "bg-success/15 text-success",
    },
    suspended: {
      label: t("buyerPanel.profile.roleStatusSuspended"),
      icon: AlertCircle,
      className: "bg-destructive/10 text-destructive",
    },
    rejected: {
      label: t("buyerPanel.profile.roleStatusRejected"),
      icon: XCircle,
      className: "bg-destructive/10 text-destructive",
    },
  };
}

function getRoleLabels(t: (key: string) => string): Record<string, string> {
  return {
    customer: t("buyerPanel.profile.roleCustomer"),
    buyer: t("buyerPanel.profile.roleBuyer"),
    animal_owner: t("buyerPanel.profile.roleAnimalOwner"),
    breeder: t("buyerPanel.profile.roleBreeder"),
    foundation_member: t("buyerPanel.profile.roleFoundationMember"),
    shelter_member: t("buyerPanel.profile.roleShelterMember"),
    operations: t("buyerPanel.profile.roleOperations"),
    driver: t("buyerPanel.profile.roleDriver"),
    moderator: t("buyerPanel.profile.roleModerator"),
    admin: t("buyerPanel.profile.roleAdmin"),
  };
}

function BuyerProfile() {
  const { t } = useTranslation();
  const roleStatusCopy = getRoleStatusCopy(t);
  const roleLabels = getRoleLabels(t);
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
      toast.error(getFriendlyErrorMessage(error, t("buyerPanel.profile.couldNotUpdate")));
      return;
    }
    toast.success(t("buyerPanel.profile.updated"));
    queryClient.invalidateQueries({ queryKey: ["my-profile", userId] });
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">{t("buyerPanel.profile.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("buyerPanel.profile.subtitle")}</p>
      </header>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-[1.4fr_1fr]">
        <div className="max-w-2xl space-y-4 rounded-2xl border border-border/70 bg-card p-6">
          {profileQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">{t("buyerPanel.profile.loading")}</p>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="displayName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("buyerPanel.profile.displayName")}</FormLabel>
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
                        <FormLabel>{t("buyerPanel.profile.phone")}</FormLabel>
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
                        <FormLabel>{t("buyerPanel.profile.city")}</FormLabel>
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
                        <FormLabel>{t("buyerPanel.profile.country")}</FormLabel>
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
                        <FormLabel>{t("buyerPanel.profile.preferredLanguage")}</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="en">{t("buyerPanel.profile.languageEnglish")}</SelectItem>
                            <SelectItem value="pl">{t("buyerPanel.profile.languagePolish")}</SelectItem>
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
                        <FormLabel>{t("buyerPanel.profile.preferredCurrency")}</FormLabel>
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
                  {form.formState.isSubmitting
                    ? t("buyerPanel.profile.saving")
                    : t("buyerPanel.profile.saveProfile")}
                </Button>
              </form>
            </Form>
          )}
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-6">
          <h2 className="mb-3 font-display text-lg font-semibold">
            {t("buyerPanel.profile.accountStatus")}
          </h2>
          {rolesQuery.isLoading && (
            <p className="text-sm text-muted-foreground">{t("buyerPanel.profile.loading")}</p>
          )}
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
              <li className="text-sm text-muted-foreground">{t("buyerPanel.profile.noRolesYet")}</li>
            )}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            {t("buyerPanel.profile.pendingRoleNote")}
          </p>
        </div>

        {userId && <AccountPrivacyCard userId={userId} />}
      </div>
    </div>
  );
}
