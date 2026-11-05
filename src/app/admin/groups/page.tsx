import { getTranslations } from "next-intl/server";
import { GroupsListView } from "./_components/groups-list-view";

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
          <h1 className="text-base font-semibold tracking-tight text-admin-title">
            {t("pageTitle")}
          </h1>
        </header>

        {/* 41.84: „Ce este un Grup?" is GroupsListView's own tile (group-about-tile.tsx), with its „Am înțeles". */}
        <GroupsListView
          fromMap={fromMap}
        />
      </main>
    </div>
  );
}
