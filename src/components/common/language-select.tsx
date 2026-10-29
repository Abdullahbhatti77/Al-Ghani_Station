import { Languages } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n, type Lang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

/** Saves the choice locally (survives refresh) and to the signed-in profile (follows the account). */
async function saveToProfile(l: Lang) {
  const { data } = await supabase.auth.getUser();
  if (data.user) await supabase.from("profiles").update({ preferred_language: l }).eq("id", data.user.id);
}

export function LanguageSelect({ className }: { className?: string }) {
  const { lang, setLang, t } = useI18n();
  return (
    <Select value={lang} onValueChange={(v) => { setLang(v as Lang); void saveToProfile(v as Lang); }}>
      <SelectTrigger className={className ?? "w-[150px]"} aria-label={t("lang.label")}>
        <Languages className="mr-1 h-4 w-4" aria-hidden />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="en">{t("lang.en")}</SelectItem>
        <SelectItem value="ur">{t("lang.ur")}</SelectItem>
      </SelectContent>
    </Select>
  );
}
