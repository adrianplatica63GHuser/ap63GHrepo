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
import { CornerButton } from "@/components/list/corner-button";
import { isDefaultOrder, sortByColumn, type ListOrder } from "@/lib/list/list-order";

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
  // 40.55: „Modificat la"'s icon names the default order itself (`changed`); in that order the list is, to the reader,
  // not sorted by any column, so it keeps the two arrows — Adrian's „default (unsorted) state" — and only „Vechi întâi"
  // puts it in use. A press flips the order as the sort button does. `aria-sort` (`ariaSortOf`) still says the truth.
  const inUse = order.sort === sort && !isDefaultOrder(order);
  const Icon = !inUse ? ArrowUpDown : order.order === "asc" ? ArrowUp : ArrowDown;
  const name = t("sortBy", { column: label });
  return (
    <span data-column-sort={sort} data-sort-state={inUse ? order.order : "none"} className="inline-flex normal-case">
      {/* Slice 40.48: the corner button's two looks, shared with the funnel — not in use the arrows alone (it was the
          funnel's then resting box, `secondary`). */}
      <CornerButton icon={Icon} label={name} inUse={inUse} solid="stroke" onPress={() => onChange(sortByColumn(order, sort))} />
    </span>
  );
}
