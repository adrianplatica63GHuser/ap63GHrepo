"use client";

/**
 * A column's sort icon, in its name cell's bottom-right corner, left of its funnel.                     (Slice 40.47)
 *
 * Adrian, 2026-10-24: „its default (unsorted) state has two arrows up and down and its sorted state has one arrow
 * either up or down depending on the direction of sorting … a sorting icon that is in use will show as a thick, solid
 * Navy blue arrow with the circle around it". Not in use, „Interacțiuni"'s ArrowUpDown in the funnel's resting look;
 * in use, ArrowUp or ArrowDown at a heavier stroke, `IN_USE_CORNER` (Ask first 6). The funnel's 13-px corner square
 * and its 20-px pressable area (`square="corner"`). A press sorts the whole list by the column (`sortByColumn`) and
 * never starts a column drag — the drag ignores a press on a button (`column-order.tsx`).
 */
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { IN_USE_CORNER, buttonClass } from "@/lib/ui/button-styles";
import { IconTooltip, SQUARE_ICON_PX } from "@/lib/ui/icon-button";
import { sortByColumn, type ListOrder } from "@/lib/list/list-order";

/** The <th>'s `aria-sort` for a column: its direction while the list is sorted by it, „none" otherwise. */
export function ariaSortOf(order: ListOrder, sort: string): "ascending" | "descending" | "none" {
  return order.sort !== sort ? "none" : order.order === "asc" ? "ascending" : "descending";
}

export function ColumnSort({
  sort,
  label,
  order,
  onChange,
}: {
  /** The sort the column names — its chooser key (`LIST_SORTS`). */
  sort: string;
  /** The column's whole name, for the icon's own: „Ordonează după „Data nașterii”". */
  label: string;
  order: ListOrder;
  onChange: (next: ListOrder) => void;
}) {
  const t = useTranslations("shared.sort");
  const inUse = order.sort === sort;
  const Icon = !inUse ? ArrowUpDown : order.order === "asc" ? ArrowUp : ArrowDown;
  const name = t("sortBy", { column: label });
  return (
    <span data-column-sort={sort} data-sort-state={inUse ? order.order : "none"} className="inline-flex normal-case">
      <IconTooltip label={name}>
        <button
          type="button"
          aria-label={name}
          className={buttonClass({ variant: "secondary", size: "xs", iconOnly: true, square: "corner", className: `relative${inUse ? ` ${IN_USE_CORNER}` : ""}` })}
          onClick={(e) => {
            e.stopPropagation();
            onChange(sortByColumn(order, sort));
          }}
        >
          <Icon size={SQUARE_ICON_PX.corner} strokeWidth={inUse ? 3.25 : 2} aria-hidden="true" className="shrink-0" />
        </button>
      </IconTooltip>
    </span>
  );
}
