import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { useAuth } from "@/domains/identity";
import { getMyFoundationProfile } from "@/domains/breeders";
import {
  campaignStatusLabels,
  createCampaign,
  listCampaignsForOrg,
  listEligibleQuotationsForOrg,
  type EligibleQuotationOption,
} from "@/domains/fundraising";
import { FUNDRAISING_ENABLED } from "@/domains/fundraising";
import { FundraisingDisabledNotice } from "@/domains/fundraising";
import { useTranslation } from "@/shared/i18n";

import { getFriendlyErrorMessage } from "@/shared/lib/errors";
export const Route = createFileRoute("/dashboard/foundation/fundraising/")({
  component: FundraisingPage,
});

function FundraisingPage() {
  const { t } = useTranslation();
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [optionId, setOptionId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const orgQuery = useQuery({
    queryKey: ["my-foundation-profile", userId],
    enabled: !!userId,
    queryFn: () => getMyFoundationProfile(userId!),
  });
  const org = orgQuery.data;
  const isEligible = org?.verification_status === "approved";

  const campaignsQuery = useQuery({
    queryKey: ["org-fundraising-campaigns", org?.id],
    enabled: !!org?.id,
    queryFn: () => listCampaignsForOrg(org!.id),
  });

  const optionsQuery = useQuery({
    queryKey: ["eligible-quotations", org?.id],
    enabled: !!org?.id && isEligible,
    queryFn: () => listEligibleQuotationsForOrg(org!.id),
  });

  const createMutation = useMutation({
    mutationFn: (option: EligibleQuotationOption) =>
      createCampaign({ organisationId: org!.id, option, title, description }),
    onSuccess: () => {
      setOpen(false);
      setOptionId("");
      setTitle("");
      setDescription("");
      queryClient.invalidateQueries({ queryKey: ["org-fundraising-campaigns", org?.id] });
      queryClient.invalidateQueries({ queryKey: ["eligible-quotations", org?.id] });
      toast.success(t("foundationPanel.fundraisingList.createdToast"));
    },
    onError: (err) =>
      toast.error(getFriendlyErrorMessage(err, t("foundationPanel.fundraisingList.createFailed"))),
  });

  if (!FUNDRAISING_ENABLED) {
    return (
      <div>
        <header className="mb-6">
          <h1 className="font-display text-3xl font-medium">
            {t("foundationPanel.fundraisingList.title")}
          </h1>
        </header>
        <FundraisingDisabledNotice />
      </div>
    );
  }

  const selectedOption = optionsQuery.data?.find((o) => o.quotationId === optionId);

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-medium">
            {t("foundationPanel.fundraisingList.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("foundationPanel.fundraisingList.subtitle")}
          </p>
        </div>
        {isEligible && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button disabled={!optionsQuery.data?.length}>
                <Plus className="mr-1 size-4" />{" "}
                {t("foundationPanel.fundraisingList.newCampaignButton")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("foundationPanel.fundraisingList.dialogTitle")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>{t("foundationPanel.fundraisingList.fieldOption")}</Label>
                  <Select value={optionId} onValueChange={setOptionId}>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={t("foundationPanel.fundraisingList.optionPlaceholder")}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {optionsQuery.data?.map((o) => (
                        <SelectItem key={o.quotationId} value={o.quotationId}>
                          {o.animalName} — {o.totalPrice ?? "?"} {o.currency}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("foundationPanel.fundraisingList.optionHint")}
                  </p>
                </div>
                <div>
                  <Label>{t("foundationPanel.fundraisingList.fieldTitle")}</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={t("foundationPanel.fundraisingList.titlePlaceholder")}
                  />
                </div>
                <div>
                  <Label>{t("foundationPanel.fundraisingList.fieldDescription")}</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <Button
                  className="w-full"
                  disabled={!selectedOption || !title.trim() || createMutation.isPending}
                  onClick={() => selectedOption && createMutation.mutate(selectedOption)}
                >
                  {t("foundationPanel.fundraisingList.createDraftButton")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </header>

      {!isEligible && (
        <div className="mb-6 rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-6 text-center text-sm text-muted-foreground">
          {t("foundationPanel.fundraisingList.notEligibleNotePrefix")}{" "}
          <span className="font-medium">
            {org?.verification_status ?? t("foundationPanel.fundraisingList.pendingStatus")}
          </span>
          .
        </div>
      )}

      {campaignsQuery.data?.length ? (
        <div className="space-y-3">
          {campaignsQuery.data.map((c) => (
            <Link
              key={c.id}
              to="/dashboard/foundation/fundraising/$id"
              params={{ id: c.id }}
              className="block rounded-2xl border border-border/70 bg-card p-5 hover:bg-secondary/40"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-display text-lg font-semibold">{c.title}</div>
                  <div className="text-sm text-muted-foreground">{c.animalName}</div>
                </div>
                <Badge variant="secondary">{campaignStatusLabels[c.status]}</Badge>
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                {c.amountCollected} / {c.targetAmount} {c.currency}{" "}
                {t("foundationPanel.fundraisingList.collectedSuffix")}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-8 text-center text-sm text-muted-foreground">
          {t("foundationPanel.fundraisingList.emptyBody")}
        </div>
      )}
    </div>
  );
}
