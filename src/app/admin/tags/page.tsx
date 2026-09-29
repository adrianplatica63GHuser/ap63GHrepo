import { getTranslations } from "next-intl/server";
import { TagManager } from "./_components/tag-manager";
import { PROSE_STYLE } from "@/lib/ui/field-widths";

export default async function TagsPage() {
  const t = await getTranslations("adminTags");
  return (
    <main className="px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold text-ink dark:text-zinc-100">
        {t("pageTitle")}
      </h1>
      <p className="mb-8 text-sm text-fade dark:text-zinc-400" style={PROSE_STYLE}>{t("pageNote")}</p>
      <TagManager />
    </main>
  );
}
