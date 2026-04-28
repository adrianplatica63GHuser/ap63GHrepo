import { getTranslations } from "next-intl/server";
import { LocaleToggle } from "@/components/locale-toggle";
import { MapView } from "./map-view";

export default async function PropertyMapPage() {
  const t = await getTranslations("property");

  return (
    <div className="flex flex-1 flex-col bg-zinc-950 h-screen">
      {/* Slim header bar */}
      <header className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <LocaleToggle />
        <h1 className="text-sm font-semibold text-zinc-100 tracking-tight">
          {t("mapTitle")}
        </h1>
        <div className="invisible">
          <LocaleToggle />
        </div>
      </header>

      {/* Full-height map — rendered client-side only */}
      <div className="flex-1 min-h-0">
        <MapView />
      </div>
    </div>
  );
}
