"use client";

/**
 * „Implicit" on a screen with no checkbox bar: the forms' reset of positions.
 *                                                              (Slice #38.12)
 *
 * On a record form „Implicit" (`useTileChoice.reset`) forgets the tile choice
 * and the dragged arrangement together. A screen whose tiles always show has
 * only the arrangement to forget: this button removes `tilePositionsKey(entity)`
 * and sends `TILE_POSITIONS_RESET`, so the row lays itself out by #37.75's rule
 * again — the screen's default placement. It stands at the screen's top right.
 */
import { useTranslations } from "next-intl";
import { buttonClass } from "@/lib/ui/button-styles";
import { TILE_POSITIONS_RESET, tilePositionsKey } from "@/lib/ui/tile-positions";

export function resetTilePositions(entity: string): void {
  try {
    localStorage.removeItem(tilePositionsKey(entity));
  } catch {
    // Private windows: nothing was kept beyond the visit.
  }
  window.dispatchEvent(new CustomEvent(TILE_POSITIONS_RESET, { detail: entity }));
}

export function TilePositionsReset({ entity }: { entity: string }) {
  const t = useTranslations("shared.tiles");
  return (
    <button
      type="button"
      onClick={() => resetTilePositions(entity)}
      className={buttonClass({ variant: "secondary", size: "sm" })}
      data-tile-positions-reset={entity}
    >
      {t("defaults")}
    </button>
  );
}
