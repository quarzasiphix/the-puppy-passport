import { createFileRoute } from "@tanstack/react-router";
import { NotImplemented } from "@/shared/ui/not-implemented";
import { useTranslation } from "@/shared/i18n";

function FoundationDocuments() {
  const { t } = useTranslation();
  return (
    <NotImplemented
      title={t("foundationPanel.documents.title")}
      purpose={t("foundationPanel.documents.purpose")}
    />
  );
}

export const Route = createFileRoute("/dashboard/foundation/documents")({
  component: FoundationDocuments,
});
