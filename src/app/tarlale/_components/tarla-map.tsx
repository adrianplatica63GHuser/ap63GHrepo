"use client";

/**
 * The tarla page's map, loaded only in the browser (the Maps bundle stays out of the server render).   (Slice #39.68)
 */
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import type { LatLon } from "@/lib/geo/tarla-outline";

function MapChunkLoading() {
  const t = useTranslations("property");
  return (
    <div className="flex h-full items-center justify-center bg-zinc-100 text-xs text-zinc-400 dark:bg-zinc-800">
      {t("map.loadingChunk")}
    </div>
  );
}

const Inner = dynamic(() => import("./tarla-map-inner"), { ssr: false, loading: () => <MapChunkLoading /> });

export function TarlaMap(props: {
  id: string;
  indicativ: string;
  locality: string | null;
  own: readonly LatLon[];
  properties: readonly { id: string; corners: readonly LatLon[] }[];
}) {
  return <Inner {...props} />;
}
