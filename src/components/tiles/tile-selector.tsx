"use client";

/**
 * The row of checkboxes that picks a detail screen's tiles.    (Slice #37.17)
 *
 * One checkbox per tile, named by the tile's Romanian name — the name the
 * specs' `showTile(page, name)` ticks — then „Toate" (every tile) and
 * „Implicit" (the default set, the one-click way back from any arrangement).
 * The last ticked box is disabled: at least one tile always shows.
 */
import { useTranslations } from "next-intl";
import { buttonClass } from "@/lib/ui/button-styles";
import type { TileChoice } from "./use-tile-choice";

export function TileSelector<K extends string>({
  all,
  labels,
  choice,
}: {
  all: readonly K[];
  labels: Readonly<Record<K, string>>;
  choice: TileChoice<K>;
}) {
  const t = useTranslations("shared.tiles");
  const lastOne = choice.shown.length === 1;
  return (
    <div role="group" aria-label={t("groupLabel")} className="flex flex-wrap items-center gap-x-4 gap-y-2" data-tile-selector>
      {all.map((key) => {
        const checked = choice.isShown(key);
        return (
          <label key={key} className="flex cursor-pointer items-center gap-1.5 text-sm font-medium text-ink dark:text-zinc-200">
            <input
              type="checkbox"
              checked={checked}
              disabled={checked && lastOne}
              title={checked && lastOne ? t("lastOne") : undefined}
              onChange={() => choice.toggle(key)}
              className="h-4 w-4 rounded border-wire accent-cta"
            />
            {labels[key]}
          </label>
        );
      })}
      <span className="flex items-center gap-2">
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
