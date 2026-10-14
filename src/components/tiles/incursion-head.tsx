"use client";

/**
 * The title line of a tile shown beside a list.                       (Slice #39.25)
 *
 * Adrian, 2026-10-13: the „Incursiune: <name>" bar above „Legături" and „Interacțiuni" goes, „the Close button to
 * come down one row, on the actual tile, on the same line with the name of the tile", and every „Deschide" on these
 * tiles goes. So the tile's own title line carries, after the tile's name, the record's — „Legături — Popescu Ion",
 * cut with „…" and whole in its tooltip (Ask first #1) — and „Închide" at its right end. The eye's „Hartă" and
 * „Pagini" wear the same line (Ask first #2), so the four lists look alike.
 *
 * The title keeps `TILE_TITLE_CLASS` (uppercase, semibold), so a locator reading the tile's `h2` still finds the
 * tile's name in it; the record's name is in sentence case beside it.
 */
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { TILE_TITLE_CLASS } from "./tile-title";

/** The record's name after the tile's: „— Popescu Ion", cut with „…", whole on hover. */
export function IncursionName({ name }: { name: string }) {
  return (
    <span className="min-w-0 truncate font-medium normal-case tracking-normal" title={name} data-incursion-name="">
      — {name}
    </span>
  );
}

/** „Închide", at the right end of the tile's title line. */
export function IncursionClose({ label, onClose }: { label: string; onClose: () => void }) {
  return <IconButton icon={X} label={label} variant="secondary" size="xs" onClick={onClose} data-incursion-close="" />;
}

/** The whole line: the tile's name, the record's, and „Închide". */
export function IncursionHead({
  title,
  name,
  closeLabel,
  onClose,
  className = "mb-2",
}: {
  title: ReactNode;
  name: string;
  closeLabel: string;
  onClose: () => void;
  /** The line's margin under it — `mb-2`, as `TileTitle`'s. */
  className?: string;
}) {
  return (
    <div className={`flex min-w-0 items-center gap-2 ${className}`} data-tile-title="" data-incursion-head="">
      <h2 className={`${TILE_TITLE_CLASS} min-w-0 flex-1`}>
        <span className="shrink-0">{title}</span>
        <IncursionName name={name} />
      </h2>
      <IncursionClose label={closeLabel} onClose={onClose} />
    </div>
  );
}
