import { Star, MessageCircle } from "lucide-react";
import { useTranslation } from "@/shared/i18n";
import type { ReviewEntry } from "@/domains/marketplace";
import { EmptyState } from "./empty-state";

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" role="img" aria-label={`${rating} / 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`size-3.5 ${n <= rating ? "fill-accent text-accent" : "text-border"}`}
        />
      ))}
    </div>
  );
}

// Reviews are the permanent, verified-buyer-only trust record described in docs/REVIEWS.md — this
// component is what finally reads that table on the public profile; before this it was hardcoded
// to always render the empty state below, regardless of what organisation_reviews actually held.
export function ReviewsTab({ reviews }: { reviews: ReviewEntry[] }) {
  const { t, locale } = useTranslation();

  if (reviews.length === 0) {
    return (
      <EmptyState icon={Star} title={t("breederProfile.noReviewsTitle")}>
        {t("breederProfile.noReviewsDesc")}
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((r) => (
        <article key={r.id} className="rounded-2xl border border-border/70 bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Stars rating={r.rating} />
              <span className="text-sm font-semibold">
                {r.reviewerDisplayName ?? t("breederProfile.reviewAnonymous")}
              </span>
            </div>
            {r.publishedAt && (
              <span className="text-xs text-muted-foreground">
                {new Date(r.publishedAt).toLocaleDateString(locale === "pl" ? "pl-PL" : "en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            )}
          </div>
          {r.animalName && (
            <p className="mt-1 text-xs text-muted-foreground">
              {t("breederProfile.reviewAboutPrefix")} {r.animalName}
            </p>
          )}
          <p className="mt-3 text-sm">{r.content}</p>
          {r.photoUrl && (
            <img
              src={r.photoUrl}
              alt=""
              className="mt-3 h-40 w-full rounded-xl object-cover sm:w-56"
            />
          )}
          {r.breederResponse && (
            <div className="mt-4 rounded-xl bg-secondary/40 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-accent">
                <MessageCircle className="size-3.5" /> {t("breederProfile.breederResponseLabel")}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{r.breederResponse}</p>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
