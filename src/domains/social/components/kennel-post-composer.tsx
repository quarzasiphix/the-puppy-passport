import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Send, PenSquare } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { createPost, POST_TYPE_LABELS, type PostType, type PostVisibility } from "@/domains/social";

// A breeder's own timeline currently had no write path at all — the "Posts" tab on a kennel
// profile only ever rendered existing rows (domains/social/services/posts.ts was read-only from
// every call site). This is the minimum real composer: text + a post type from the
// breeder-relevant subset + visibility + an optional link to one of the kennel's own litters/
// puppies (linked_litter_id/linked_animal_id — see PostReferences in domains/social/types.ts) so a
// post about a real litter shows up wherever that litter's history is shown, not just as free text.
// Image upload is NOT wired here yet — post-media is a private bucket whose read policy mirrors
// can_view_post() (docs/SOCIAL_DOMAIN.md), which needs its own signed-URL-aware upload flow; see
// docs/STORAGE_AND_MEDIA.md's uploadPrivateFile for the primitive this would build on.

const KENNEL_POST_TYPES: PostType[] = [
  "general",
  "litter_announcement",
  "planned_mating",
  "availability_announcement",
  "dog_update",
  "health_update",
  "achievement",
];

export function KennelPostComposer({
  organisationId,
  authorProfileId,
  litters,
  puppies,
  onPosted,
}: {
  organisationId: string;
  authorProfileId: string;
  litters: { id: string; label: string }[];
  puppies: { id: string; label: string }[];
  onPosted?: () => void;
}) {
  const [postType, setPostType] = useState<PostType>("general");
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<PostVisibility>("public");
  const [linkedLitterId, setLinkedLitterId] = useState<string>("");
  const [linkedAnimalId, setLinkedAnimalId] = useState<string>("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      createPost(authorProfileId, {
        postType,
        content: content.trim() || null,
        visibility,
        authorOrganizationId: organisationId,
        linkedLitterId: linkedLitterId || null,
        linkedAnimalId: linkedAnimalId || null,
      }),
    onSuccess: () => {
      toast.success("Posted to your kennel timeline.");
      setContent("");
      setLinkedLitterId("");
      setLinkedAnimalId("");
      queryClient.invalidateQueries({ queryKey: ["kennel-posts", organisationId] });
      onPosted?.();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not post."),
  });

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <span className="grid size-7 place-items-center rounded-full bg-primary/10 text-primary">
          <PenSquare className="size-3.5" />
        </span>
        New post to your kennel timeline
      </div>
      <Textarea
        rows={3}
        placeholder="Share an update with your followers…"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Post type</Label>
          <Select value={postType} onValueChange={(v) => setPostType(v as PostType)}>
            <SelectTrigger className="bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KENNEL_POST_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {POST_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Who can see this</Label>
          <Select value={visibility} onValueChange={(v) => setVisibility(v as PostVisibility)}>
            <SelectTrigger className="bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">Public — everyone</SelectItem>
              <SelectItem value="followers">Followers only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {litters.length > 0 && (
          <div>
            <Label>About a litter (optional)</Label>
            <Select value={linkedLitterId} onValueChange={setLinkedLitterId}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                {litters.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {puppies.length > 0 && (
          <div>
            <Label>About a puppy (optional)</Label>
            <Select value={linkedAnimalId} onValueChange={setLinkedAnimalId}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                {puppies.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <div className="mt-4 flex justify-end border-t border-border/60 pt-3">
        <Button disabled={!content.trim() || mutation.isPending} onClick={() => mutation.mutate()}>
          <Send className="size-4" /> Post to timeline
        </Button>
      </div>
    </div>
  );
}
