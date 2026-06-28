import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { GroupsListView } from "./_components/groups-list-view";

export default async function GroupsPage() {
  const t = await getTranslations("group");

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-4xl px-6 py-8 flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <Link
            href="/admin/value-lists"
            className="text-xs text-fade hover:text-ink dark:hover:text-zinc-200"
          >
            ← {t("backToValueLists")}
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("pageTitle")}
          </h1>
        </header>

        <GroupsListView />
      </main>
    </div>
  );
}
