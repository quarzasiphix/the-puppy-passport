import { createFileRoute } from "@tanstack/react-router";
import { NotImplemented } from "@/shared/ui/not-implemented";
import { useTranslation } from "@/shared/i18n";

function BreederDocuments() {
  const { t } = useTranslation();
  return (
    <NotImplemented
      title={t("breederPanel.documents.title")}
      purpose={t("breederPanel.documents.purpose")}
    />
  );
}

export const Route = createFileRoute("/dashboard/breeder/documents")({
  component: BreederDocuments,
});
