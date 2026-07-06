import { getTranslations } from "next-intl/server";
import { TagManager } from "./_components/tag-manager";

export default async function TagsPage() {
  const t = await getTranslations("adminTags");
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold text-ink dark:text-zinc-100">
        {t("pageTitle")}
      </h1>
      <p className="mb-8 text-sm text-fade dark:text-zinc-400">{t("pageNote")}</p>
      <TagManager />
    </main>
  );
}
