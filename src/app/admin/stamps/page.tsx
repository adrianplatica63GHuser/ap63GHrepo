import { getTranslations } from "next-intl/server";
import { StampsListView } from "./_components/stamps-list-view";
import { ListHeading } from "@/lib/ui/record-heading";
import { adminIcon } from "@/components/sidebar/nav-config";

// Slice #20.17: BackLink removed — BreadcrumbBar shows the trail. Slice #38.20:
// „Acasă › Administrare › Ștampile", the section as text (it has no screen).

export default async function StampsPage() {
  const t = await getTranslations("stamp");

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="w-full px-6 py-8 flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          {/* 41.92: „Persoane fizice"'s heading, in Administrare's red, after the side panel's icon (it was 16 px). */}
          <ListHeading icon={adminIcon("stamps")} title={t("pageTitle")} admin />
        </header>

        {/* Slice 41.99: „Ce este o Ștampilă?" is StampsListView's own tile (stamp-about-tile.tsx), with its „Am înțeles",
            as „Ce este un Grup?" is GroupsListView's. It was a section written out here. */}
        <StampsListView />
      </main>
    </div>
  );
}
