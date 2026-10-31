"use client";

/**
 * The words a tile's width handle says, in the screen's language.                     (Slice 41.17)
 *
 * A hook of its own, so the tile packing (use-tile-packing.ts) imports nothing from next-intl: the screens that pack
 * tiles (`TileAreas`, `TileUnitRow`) read these and hand them over.
 */
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { TileWidthWords } from "./tile-width-words";

export function useTileWidthWords(): TileWidthWords {
  const t = useTranslations("shared.tileWidth");
  return useMemo(() => ({ handle: (title: string) => t("handle", { title }), units: (count: number) => t("units", { count }) }), [t]);
}
