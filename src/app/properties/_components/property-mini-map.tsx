"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import type { Corner } from "./form-schema";

/**
 * Slice #32.16: the chunk-loading fallback. Its text was hard-coded English,
 * and it is the FIRST thing a Romanian user sees on this route — the
 * `map.loading` state inside the chunk cannot render until the chunk has
 * already arrived. A component rather than inline JSX because it needs a hook.
 */
function MapChunkLoading() {
  const t = useTranslations("property");
  return (
    <div className="flex h-full items-center justify-center bg-zinc-100 text-zinc-400 text-xs dark:bg-zinc-800">
      {t("map.loadingChunk")}
    </div>
  );
}

// Dynamically imported to keep the Maps bundle out of the server render.
const Inner = dynamic(() => import("./property-mini-map-inner"), {
  ssr: false,
  loading: () => <MapChunkLoading />,
});

type Props = {
  corners:           Corner[];
  onChange:          (next: Corner[]) => void;
  readOnly?:         boolean;
  hoveredCornerIdx?: number | null;
  onCornerHover?:    (idx: number | null) => void;
  showAngles?:       boolean;
  /** Slice #37.38 — see property-mini-map-inner.tsx. The form's tile only. */
  onZoomChange?:     (zoom: number | null) => void;
  /** Slice #37.91 — see property-mini-map-inner.tsx. The form's tile only. */
  onFullScreen?:     () => void;
  /** Slice #38.09 — see property-mini-map-inner.tsx. Both maps. */
  onToggleAngles?:   () => void;
};

export function PropertyMiniMap({ corners, onChange, readOnly, hoveredCornerIdx, onCornerHover, showAngles, onZoomChange, onFullScreen, onToggleAngles }: Props) {
  return (
    <Inner
      corners={corners}
      onChange={onChange}
      readOnly={readOnly}
      hoveredCornerIdx={hoveredCornerIdx}
      onCornerHover={onCornerHover}
      showAngles={showAngles}
      onZoomChange={onZoomChange}
      onFullScreen={onFullScreen}
      onToggleAngles={onToggleAngles}
    />
  );
}
