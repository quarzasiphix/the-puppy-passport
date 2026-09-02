import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Star, CheckCircle2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";
import { Label } from "@/shared/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { getMyReview, submitReview } from "../services/transport";

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} aria-label={`${n} stars`}>
          <Star
            className={`size-6 ${n <= value ? "fill-warning text-warning" : "text-muted-foreground"}`}
          />
        </button>
      ))}
    </div>
  );
}

export function ReviewTransportDialog({
  transportRequestId,
  userId,
}: {
  transportRequestId: string;
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [driverRating, setDriverRating] = useState(0);
  const [comment, setComment] = useState("");

  const existingQuery = useQuery({
    queryKey: ["my-review", transportRequestId],
    queryFn: () => getMyReview(transportRequestId),
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: () =>
      submitReview({
        transportRequestId,
        reviewerProfileId: userId,
        rating,
        driverRating: driverRating || null,
        wouldRecommend: null,
        comment: comment || null,
      }),
    onSuccess: () => {
      toast.success("Thank you for your feedback.");
      queryClient.invalidateQueries({ queryKey: ["my-review", transportRequestId] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not submit review."),
  });

  const existing = existingQuery.data;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Star className="mr-1 size-4" /> Rate this transport
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rate this transport</DialogTitle>
        </DialogHeader>
        {existing ? (
          <div className="py-4 text-center">
            <CheckCircle2 className="mx-auto size-8 text-success" />
            <p className="mt-3 font-medium">You already rated this transport</p>
            <div className="mt-2 flex justify-center">
              <StarPicker value={existing.rating} onChange={() => {}} />
            </div>
            {existing.comment && (
              <p className="mt-2 text-sm text-muted-foreground">"{existing.comment}"</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>Overall experience</Label>
              <div className="mt-1">
                <StarPicker value={rating} onChange={setRating} />
              </div>
            </div>
            <div>
              <Label>Driver (optional)</Label>
              <div className="mt-1">
                <StarPicker value={driverRating} onChange={setDriverRating} />
              </div>
            </div>
            <div>
              <Label>Anything you'd like to share (optional)</Label>
              <Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
            </div>
            <Button
              className="w-full"
              disabled={rating === 0 || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              Submit review
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
