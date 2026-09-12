import { createFileRoute } from "@tanstack/react-router";
import { NotImplemented } from "@/shared/ui/not-implemented";
import { useTranslation } from "@/shared/i18n";

function BuyerDocuments() {
  const { t } = useTranslation();
  return (
    <NotImplemented
      title={t("buyerPanel.documents.title")}
      purpose={t("buyerPanel.documents.purpose")}
    />
  );
}

export const Route = createFileRoute("/dashboard/buyer/documents")({
  component: BuyerDocuments,
});
