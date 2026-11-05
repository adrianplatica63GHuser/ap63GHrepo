import { getTranslations } from "next-intl/server";
import { StampsListView } from "./_components/stamps-list-view";
import { screenPanel } from "@/lib/ui/field-widths";
import { TileTitle } from "@/components/tiles/tile-title";

// Slice #20.17: BackLink removed — BreadcrumbBar shows the trail. Slice #38.20:
// „Acasă › Administrare › Ștampile", the section as text (it has no screen).

export default async function StampsPage() {
  const t = await getTranslations("stamp");

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="w-full px-6 py-8 flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-base font-semibold tracking-tight text-admin-title">
            {t("pageTitle")}
          </h1>
        </header>

        {/* Info panel — what is a Stamp and when to use it. Slice #37.35: the first tile of the list's unit row (6 units; 7 of 119 px since 40.98). */}
        <StampsListView
          about={
            <section {...screenPanel("about-stamps", 7 /* 40.98: re-pinned, 6 of 148 px */)} data-tile="about" className="rounded-lg border border-card-rim bg-card px-5 py-4">
          {/* 41.41: a tile of the screen now, so its heading is TileTitle's (tile-heading-one-piece). */}
          <TileTitle title={t("infoPanel.title")} className="mb-3" admin />
          <div className="flex flex-col gap-2 text-sm text-ink">
            <p>{t("infoPanel.body1")}</p>
            <p>{t("infoPanel.body2")}</p>
            <p>{t("infoPanel.body3")}</p>
            <p className="text-xs text-fade">
              {t("infoPanel.codeNote")}
            </p>
            <p className="mt-1 border-t border-card-rim pt-2 text-xs italic text-fade">
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
