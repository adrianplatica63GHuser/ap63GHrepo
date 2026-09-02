"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";

/**
 * Slice #32.16: the chunk-loading fallback. Its text was hard-coded English,
 * and it is the FIRST thing a Romanian user sees on this route — the
 * `map.loading` state inside the chunk cannot render until the chunk has
 * already arrived. A component rather than inline JSX because it needs a hook.
 */
function MapChunkLoading() {
  const t = useTranslations("property");
  return (
    <div className="flex h-full items-center justify-center bg-zinc-950 text-zinc-400 text-sm">
      {t("map.loadingChunk")}
    </div>
  );
}

// Dynamically imported to keep the Maps bundle out of the server render.
const PropertyMap = dynamic(() => import("./property-map"), {
  ssr: false,
  loading: () => <MapChunkLoading />,
});

export function MapView() {
  return <PropertyMap />;
}
