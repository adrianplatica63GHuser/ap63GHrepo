import { getTranslations } from "next-intl/server";
import { MapView } from "./map-view";

export default async function PropertyMapPage() {
  const t = await getTranslations("property");

  return (
    // h-full fills the AppShell content area (= viewport height via flex chain)
    <div className="flex flex-1 flex-col bg-zinc-950 h-full">
      {/* Slim header bar */}
      <header className="flex items-center justify-center px-4 py-2 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <h1 className="text-sm font-semibold text-zinc-100 tracking-tight">
          {t("mapTitle")}
        </h1>
      </header>

      {/* Full-height map — rendered client-side only */}
      {/* relative + absolute inset-0 gives Google Maps a concrete bounding box */}
      <div className="flex-1 min-h-0 relative">
        <div className="absolute inset-0">
          <MapView />
        </div>
      </div>
    </div>
  );
}
