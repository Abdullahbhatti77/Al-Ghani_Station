import { Construction } from "lucide-react";
import { PageHeader } from "@/components/common/page";
import { EmptyState } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { useT, type TranslationKey } from "@/lib/i18n";

export function ModulePlaceholder({ titleKey, descKey }: { titleKey: TranslationKey; descKey: TranslationKey }) {
  const t = useT();
  return (
    <>
      <PageHeader title={t(titleKey)} description={t(descKey)} actions={<Badge variant="secondary">{t("common.comingNext")}</Badge>} />
      <EmptyState icon={<Construction className="h-6 w-6" aria-hidden />} title={t("module.emptyTitle")} body={t("module.emptyBody")} />
    </>
  );
}
