import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MapPin, UserPlus, UserCheck, Dog, HeartHandshake } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  followProfile,
  getPublicOrgLinkForOwner,
  getPublicProfile,
  isFollowingProfile,
  listPublicPostsByAuthor,
  unfollowProfile,
} from "@/lib/queries/profile";
import { orgProfileRoute } from "@/lib/org-routing";

export const Route = createFileRoute("/_public/profile/$profileId")({
  loader: async ({ params }) => {
    const profile = await getPublicProfile(params.profileId).catch(() => null);
    if (!profile) throw notFound();
    const [posts, orgLink] = await Promise.all([
      listPublicPostsByAuthor(profile.id),
      getPublicOrgLinkForOwner(profile.id),
    ]);
    return { profile, posts, orgLink };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.profile.display_name ?? "Havenpaw member"} — Havenpaw`
          : "Profile — Havenpaw",
      },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { profile, posts, orgLink } = Route.useLoaderData();
  const { userId, isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const isOwnProfile = userId === profile.id;

  const followingQuery = useQuery({
    queryKey: ["is-following-profile", userId, profile.id],
    queryFn: () => isFollowingProfile(userId!, profile.id),
    enabled: isSignedIn && !!userId && !isOwnProfile,
  });

  const followMutation = useMutation({
    mutationFn: () =>
      followingQuery.data
        ? unfollowProfile(userId!, profile.id)
        : followProfile(userId!, profile.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["is-following-profile", userId, profile.id] });
      toast.success(followingQuery.data ? "Unfollowed." : "Following.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update follow."),
  });

  return (
    <div className="container-page max-w-3xl py-12">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border/70 bg-card p-6">
        <div className="flex items-center gap-4">
          <Avatar className="size-16">
            <AvatarImage src={profile.avatar_url ?? undefined} />
            <AvatarFallback className="text-lg">
              {(profile.display_name ?? "?").charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="font-display text-2xl font-semibold">
              {profile.display_name ?? "Havenpaw member"}
            </h1>
            {(profile.city || profile.country) && (
              <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="size-3.5" />
                {[profile.city, profile.country].filter(Boolean).join(", ")}
              </div>
            )}
            {orgLink && orgLink.orgType === "kennel" && (
              <Link
                to={orgProfileRoute(orgLink.orgType)}
                params={{ slug: orgLink.slug }}
                className="mt-2 inline-flex w-fit items-center gap-1 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Dog className="size-3.5" /> View kennel profile
              </Link>
            )}
            {orgLink && orgLink.orgType !== "kennel" && (
              <Link
                to={orgProfileRoute(orgLink.orgType)}
                params={{ slug: orgLink.slug }}
                className="mt-2 inline-flex w-fit items-center gap-1 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <HeartHandshake className="size-3.5" /> View foundation profile
              </Link>
            )}
          </div>
        </div>

        {isSignedIn && !isOwnProfile && (
          <Button
            variant={followingQuery.data ? "outline" : "default"}
            disabled={followMutation.isPending || followingQuery.isLoading}
            onClick={() => followMutation.mutate()}
          >
            {followingQuery.data ? (
              <>
                <UserCheck className="mr-1 size-4" /> Following
              </>
            ) : (
              <>
                <UserPlus className="mr-1 size-4" /> Follow
              </>
            )}
          </Button>
        )}
      </div>

      <div className="mt-8">
        <h2 className="font-display text-lg font-semibold">Posts</h2>
        {posts.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No public posts yet.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {posts.map((post) => (
              <article key={post.id} className="rounded-2xl border border-border/70 bg-card p-4">
                <p className="text-sm">{post.content}</p>
                <div className="mt-2 text-xs text-muted-foreground">
                  {new Date(post.created_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
