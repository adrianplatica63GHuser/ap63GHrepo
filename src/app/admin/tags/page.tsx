import { getTranslations } from "next-intl/server";
import { TagManager } from "./_components/tag-manager";

export default async function TagsPage() {
  const t = await getTranslations("adminTags");
  return (
    // 41.83: the record screens' off-white (it stood on the canvas's beige), its heading in #C00000.
    <main className="flex flex-1 flex-col bg-zinc-50 px-4 py-8 dark:bg-zinc-950">
      <h1 className="mb-2 text-base font-bold text-admin-title">
        {t("pageTitle")}
      </h1>
      {/* Slice 41.41: the note is the screen's first tile now (TagManager), chosen with „Panouri" like the cloud. */}
      <TagManager note={t("pageNote")} />
    </main>
  );
}
