"use client";

/**
 * The row of checkboxes that picks a detail screen's tiles.    (Slice #37.17)
 *
 * One checkbox per tile, named by the tile's Romanian name — the name the
 * specs' `showTile(page, name)` ticks — then „Toate" (every tile) and
 * „Implicit" (the default set, the one-click way back from any arrangement).
 * The last ticked box is disabled: at least one tile always shows.
 *
 * Slice #37.20: `marked` names tiles that are NOT shown but hold something to
 * look at (a highlighted field on a Document). Their box gets a dot and a
 * title saying so. The dot sits OUTSIDE the <label>, so a marked checkbox keeps
 * exactly its tile's name — the name `showTile` ticks it by.
 *
 * Slice #38.04: `disabled` names tiles the record cannot show now, each with
 * the reason (a Property's type). Such a box is drawn unticked and disabled,
 * its label greyed and in italics, the reason its tooltip; „Toate" and
 * „Implicit" leave it alone (`useTileChoice`), and it never counts as the last
 * ticked box.
 */
import { useTranslations } from "next-intl";
import { HelpHint } from "@/components/help/help-hint";
import { buttonClass } from "@/lib/ui/button-styles";
import type { TileChoice } from "./use-tile-choice";
import type { TileGroup } from "@/lib/ui/tiles";
import { groupStrip } from "@/lib/ui/tile-surface";

export function TileSelector<K extends string>({
  all,
  groups,
  labels,
  choice,
  marked = [],
  extra = [],
  disabled,
}: {
  all: readonly K[];
  /**
   * Slice #37.88: the registry's groups (`groupedTiles`). Each group's boxes
   * stand in a narrow strip of its colour, in this order; the previews' boxes
   * go in „Corelate"'s, since „Corelate" opens them. Absent (the home page),
   * the boxes stand in one row as before.
   */
  groups?: readonly { group: TileGroup; tiles: readonly K[] }[];
  labels: Readonly<Record<K, string>>;
  choice: TileChoice<K>;
  /** Tiles not on screen that hold something to look at (Slice #37.20). */
  marked?: readonly K[];
  /**
   * Tiles that exist only while open — the Previzualizare tiles (Slice #37.24).
   * Each is a ticked box after the screen's own; unticking it closes the tile.
   */
  extra?: readonly { key: string; label: string; onRemove: () => void }[];
  /** Slice #38.04: tiles the record cannot show now, each with its reason (the tooltip). */
  disabled?: Readonly<Partial<Record<K, string>>>;
}) {
  const t = useTranslations("shared.tiles");
  const isOff = (key: K): boolean => disabled?.[key] !== undefined;
  // #38.04: a disabled box is never „the last ticked box".
  const lastOne = choice.shown.filter((k) => !isOff(k)).length === 1;
  const box = (key: K) => {
    const off = isOff(key);
    const checked = choice.isShown(key) && !off;
    const isMarked = !checked && !off && marked.includes(key);
    const reason = off ? disabled?.[key] : checked && lastOne ? t("lastOne") : undefined;
    return (
      <span key={key} className="flex items-center gap-1">
      <label
        className={
          off
            ? "flex cursor-not-allowed items-center gap-1.5 text-sm font-medium italic text-fade dark:text-zinc-500"
            : "flex cursor-pointer items-center gap-1.5 text-sm font-medium text-ink dark:text-zinc-200"
        }
        title={off ? reason : undefined}
        data-tile-disabled={off ? key : undefined}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={off || (checked && lastOne)}
          title={reason}
          onChange={() => {
            if (!off) choice.toggle(key);
          }}
          className="h-4 w-4 rounded border-wire accent-cta"
        />
        {labels[key]}
      </label>
      {isMarked && (
        <span
          role="img"
          aria-label={t("marked")}
          title={t("marked")}
          data-tile-marked={key}
          className="inline-block h-2 w-2 rounded-full bg-amber-500"
        />
      )}
      </span>
    );
  };
  const extras = extra.map((x) => (
    <label key={x.key} className="flex cursor-pointer items-center gap-1.5 text-sm font-medium text-ink dark:text-zinc-200" data-tile-extra={x.key}>
      <input type="checkbox" checked onChange={x.onRemove} className="h-4 w-4 rounded border-wire accent-cta" />
      {x.label}
    </label>
  ));
  return (
    <div role="group" aria-label={t("groupLabel")} className="flex flex-wrap items-center gap-x-4 gap-y-2" data-tile-selector>
      {groups ? (
        groups.map(({ group, tiles }) => (
          <span key={group} className={groupStrip(group)} data-tile-group={group}>
            {tiles.map(box)}
            {group === "related" && extras}
          </span>
        ))
      ) : (
        <>
          {all.map(box)}
          {extras}
        </>
      )}
      {groups && !groups.some((g) => g.group === "related") && extras}
      <span className="flex items-center gap-2">
        {/* Slice #37.23 — what the choice does and where it is kept. The text is
            Adrian's, in Texte de ajutor; until he writes it the hint draws nothing. */}
        <HelpHint hintKey="tile-selector" />
        <button type="button" onClick={choice.showAll} className={buttonClass({ variant: "secondary", size: "sm" })}>
          {t("all")}
        </button>
        <button type="button" onClick={choice.reset} className={buttonClass({ variant: "secondary", size: "sm" })}>
          {t("defaults")}
        </button>
      </span>
    </div>
  );
}
