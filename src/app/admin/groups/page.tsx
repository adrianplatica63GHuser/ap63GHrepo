import { getTranslations } from "next-intl/server";
import { GroupsListView } from "./_components/groups-list-view";
import { screenPanel } from "@/lib/ui/field-widths";
import { PAGE_HEADING_TYPE } from "@/lib/ui/title-type";

// Slice #20.17: BackLink removed — BreadcrumbBar shows the trail. Slice #38.20:
// „Acasă › Administrare › Grupuri", the section as text (it has no screen).

type PageProps = { searchParams: Promise<{ from?: string }> };

export default async function GroupsPage({ searchParams }: PageProps) {
  const t = await getTranslations("group");
  // Slice #39.73: the big map's „Grup nou…" arrives with ?from=map — the add form opens for a property group, and the
  // screen offers the way back, where the selection waits.
  const fromMap = (await searchParams).from === "map";

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="w-full px-6 py-8 flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("pageTitle")}
          </h1>
        </header>

        {/* Info panel — what is a Group and when to use it. Slice #37.35: the first tile of the list's unit row (6 units). */}
        <GroupsListView
          fromMap={fromMap}
          about={
            <section {...screenPanel("about-groups", 6)} className="rounded-lg border border-blue-200 bg-blue-50 px-5 py-4 dark:border-blue-900 dark:bg-blue-950/40">
          <h2 className={`mb-3 ${PAGE_HEADING_TYPE}`}>
            {t("infoPanel.title")}
          </h2>
          <div className="flex flex-col gap-2 text-sm text-blue-800 dark:text-blue-300">
            <p>{t("infoPanel.body1")}</p>
            <p>{t("infoPanel.body2")}</p>
            <p className="text-xs text-blue-600 dark:text-blue-400">
              {t("infoPanel.codeNote")}
            </p>
            <p className="mt-1 border-t border-blue-200 pt-2 text-xs italic text-blue-600 dark:border-blue-800 dark:text-blue-400">
              {t("infoPanel.seeAlso")}
            </p>
          </div>
        </section>
          }
        />
      </main>
    </div>
  );
}
