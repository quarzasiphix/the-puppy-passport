import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Label } from "@/shared/ui/label";
import { Badge } from "@/shared/ui/badge";
import { Card } from "@/shared/ui/panel";
import { useAuth } from "@/domains/identity";
import { getMyKennelProfile, updateKennel } from "@/domains/breeders";

import { getFriendlyErrorMessage } from "@/shared/lib/errors";
export const Route = createFileRoute("/dashboard/breeder/profile")({
  component: ProfilePage,
});

const schema = z.object({
  description: z.string().optional(),
  coverImageUrl: z.string().optional(),
  logoUrl: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  associationName: z.string().optional(),
  membershipNumber: z.string().optional(),
  yearsExperience: z.coerce.number().min(0).optional(),
  responseTime: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

function ProfilePage() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["my-kennel-profile", userId],
    enabled: !!userId,
    queryFn: () => getMyKennelProfile(userId!),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: query.data
      ? {
          description: query.data.description ?? "",
          coverImageUrl: query.data.cover_image_url ?? "",
          logoUrl: query.data.logo_url ?? "",
          city: query.data.city ?? "",
          country: query.data.country ?? "",
          associationName: query.data.association_name ?? "",
          membershipNumber: query.data.membership_number ?? "",
          yearsExperience: query.data.years_experience ?? undefined,
          responseTime: query.data.response_time ?? "",
        }
      : undefined,
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (!query.data) throw new Error("Kennel not loaded");
      return updateKennel(query.data.id, {
        description: values.description || null,
        cover_image_url: values.coverImageUrl || null,
        logo_url: values.logoUrl || null,
        city: values.city || null,
        country: values.country || null,
        association_name: values.associationName || null,
        membership_number: values.membershipNumber || null,
        years_experience: values.yearsExperience ?? null,
        response_time: values.responseTime || null,
      });
    },
    onSuccess: () => {
      toast.success("Profile updated.");
      queryClient.invalidateQueries({ queryKey: ["my-kennel-profile", userId] });
    },
    onError: (err) => toast.error(getFriendlyErrorMessage(err, "Could not save.")),
  });

  const v = form.watch();

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-medium">Public profile</h1>
          <p className="text-sm text-muted-foreground">How buyers see your kennel on Havenpaw.</p>
        </div>
        {query.data?.slug && (
          <Button asChild variant="outline">
            <Link to="/breeders/$slug" params={{ slug: query.data.slug }}>
              View live profile
            </Link>
          </Button>
        )}
      </header>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !query.data ? (
        <p className="text-sm text-muted-foreground">No kennel found for your account yet.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <Card title="Edit profile">
            <form
              onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
              className="space-y-4"
            >
              <div>
                <Label>Description</Label>
                <Textarea rows={5} {...form.register("description")} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Cover image URL</Label>
                  <Input placeholder="https://…" {...form.register("coverImageUrl")} />
                </div>
                <div>
                  <Label>Logo URL</Label>
                  <Input placeholder="https://…" {...form.register("logoUrl")} />
                </div>
                <div>
                  <Label>City</Label>
                  <Input {...form.register("city")} />
                </div>
                <div>
                  <Label>Country</Label>
                  <Input {...form.register("country")} />
                </div>
                <div>
                  <Label>Association</Label>
                  <Input placeholder="e.g. FCI, KC" {...form.register("associationName")} />
                </div>
                <div>
                  <Label>Membership number</Label>
                  <Input {...form.register("membershipNumber")} />
                </div>
                <div>
                  <Label>Years of experience</Label>
                  <Input type="number" min={0} {...form.register("yearsExperience")} />
                </div>
                <div>
                  <Label>Typical response time</Label>
                  <Input placeholder="e.g. Within a day" {...form.register("responseTime")} />
                </div>
              </div>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving…" : "Save changes"}
              </Button>
              {query.data.verification_status !== "approved" && (
                <p className="text-xs text-muted-foreground">
                  Your kennel isn't approved yet, so this profile isn't publicly visible. You can
                  still fill it in ahead of approval.
                </p>
              )}
            </form>
          </Card>

          <Card title="Preview">
            <div className="overflow-hidden rounded-xl border border-border/70">
              <img
                src={v.coverImageUrl || "/images/seed/hero-breeder.jpg"}
                alt=""
                className="h-40 w-full object-cover"
              />
              <div className="p-4">
                <div className="flex items-center gap-2">
                  <div className="font-display text-lg font-semibold">{query.data.name}</div>
                  {query.data.verification_status === "approved" && (
                    <Badge className="bg-primary/90 text-primary-foreground">Verified</Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {v.city}, {v.country}
                  {v.responseTime ? ` · Responds ${v.responseTime}` : ""}
                </div>
                <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
                  {v.description || "No description yet."}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
