import { getTranslations } from "next-intl/server";
import { TagManager } from "./_components/tag-manager";

export default async function TagsPage() {
  const t = await getTranslations("adminTags");
  return (
    <main className="px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold text-ink dark:text-zinc-100">
        {t("pageTitle")}
      </h1>
      {/* Slice 41.41: the note is the screen's first tile now (TagManager), chosen with „Panouri" like the cloud. */}
      <TagManager note={t("pageNote")} />
    </main>
  );
}
