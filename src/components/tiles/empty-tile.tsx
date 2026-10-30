"use client";

/**
 * An empty form tile, drawn as one line — its title, a short state, and „Adaugă".          (Slice 40.64)
 *
 * On the four record screens a form tile with nothing in it (`tileIsEmpty`, src/lib/ui/empty-tile.ts) took as much
 * room as a full one: „Adresă corespondență" drew six empty boxes as tall as the home address above it. Now it is one
 * line. „Adaugă" opens it to today's form, with the focus in its first field; once opened it stays open until the
 * record is left.
 *
 * ⚠️ **THE FIELDS STAY MOUNTED.** The one line is drawn in front of the tile's own body, which is only hidden — so
 * react-hook-form keeps every registration, a version's `form.reset` still reaches the boxes, and nothing typed is
 * lost by a tile closing. The tile packing measures tiles as drawn (`use-tile-packing.ts`), so a collapsed tile packs
 * as a short one and an opened one re-packs, as a grown tile always did.
 *
 * A tile is drawn whole — never as the line — on a new record, while a version marks a field in it (the pulse must be
 * seen), and while a field in it carries an error. A read-only view (a version, `?readonly=true`) draws the line
 * without „Adaugă".
 */
import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { TILE_TITLE_CLASS } from "@/components/tiles/tile-title";

/** The first box a person types into, inside the tile's panel. */
const FIRST_FIELD =
  'input:not([type="hidden"]):not([type="checkbox"]):not([disabled]), select:not([disabled]), textarea:not([disabled])';

/** Focuses the first field inside the element `selector` names (the tile's panel), once React has drawn it. */
export function focusFirstField(selector: string): void {
  // A timeout rather than an animation frame: a browser does not run frames in a tab that is not in front.
  setTimeout(() => {
    const root = document.querySelector(selector);
    const box = root?.querySelector<HTMLElement>(FIRST_FIELD);
    box?.focus();
  }, 0);
}

export type EmptyTiles = {
  /** The tile is drawn as one line: the record is not new, the tile is empty, nothing asks for it whole, not opened. */
  collapsed: (key: string, empty: boolean, whole?: boolean) => boolean;
  /** Opens the tile for this visit and puts the focus in the first field inside `selector` (its panel). */
  open: (key: string, selector: string) => void;
  /** „Adaugă" is offered — false on a read-only view. */
  canAdd: boolean;
};

/**
 * Which tiles are open for this visit. `active` is false on a new record (every tile stays open, Out of scope);
 * `canAdd` is false on a read-only view.
 */
export function useEmptyTiles({ active, canAdd }: { active: boolean; canAdd: boolean }): EmptyTiles {
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set());
  const collapsed = useCallback(
    (key: string, empty: boolean, whole = false) => active && empty && !whole && !opened.has(key),
    [active, opened],
  );
  const open = useCallback((key: string, selector: string) => {
    setOpened((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
    focusFirstField(selector);
  }, []);
  return { collapsed, open, canAdd };
}

/**
 * The state words the line can say. Any tile says „necompletat"; the two the header names keep their own (Ask first
 * 2) — „aceeași cu domiciliul", „niciun act înregistrat" — and the firm's correspondence address, whose box reads
 * „Aceeași cu adresa sediului social", says „aceeași cu sediul social".
 */
export type EmptyTileState = "empty" | "sameAsHome" | "sameAsHq" | "noIdDocument";

/**
 * The line itself. `title` is the tile's own; `onAdd` absent (a read-only view) draws no button. The tile's `h2` is
 * kept, so a locator reading the tile by its heading still finds it.
 */
export function EmptyTileLine({
  title,
  state = "empty",
  onAdd,
  tile,
}: {
  title: string;
  state?: EmptyTileState;
  onAdd?: () => void;
  /** The tile's key, for the e2e helper (`data-empty-tile`). */
  tile: string;
}) {
  const t = useTranslations("shared.emptyTile");
  return (
    // `flex-wrap`: in a narrow panel („Reprezentanți și contact", 310 px) „Adaugă" goes under the title rather than past
    // the panel's edge. Slice 41.05: on a 2-unit tile (228 px inside) the title itself is wider than the panel — it
    // wraps inside it (`max-w-full`, was `shrink-0`), as a tile's own title does.
    <div className="flex min-h-8 min-w-0 flex-wrap items-center gap-x-3 gap-y-1" data-empty-tile={tile}>
      <h2 className={`${TILE_TITLE_CLASS} min-w-0 max-w-full`}>{title}</h2>
      <span className="min-w-0 truncate text-sm text-fade dark:text-zinc-400" data-empty-tile-state={state}>
        {t(`state.${state}`)}
      </span>
      {onAdd && (
        <IconButton
          icon={Plus}
          label={t("addTo", { tile: title })}
          variant="secondary"
          size="sm"
          className="ml-auto shrink-0"
          onClick={onAdd}
          data-empty-tile-add=""
        />
      )}
    </div>
  );
}
