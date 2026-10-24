"use client";

/**
 * A principal list's sort button.                                                                        (Slice 40.46)
 *
 * „Interacțiuni"'s button (`history-tile.tsx`): its icons — ArrowDownWideNarrow for the newest first,
 * ArrowUpNarrowWide for the oldest — and its press, which flips the date order and takes any other order back to it.
 * Its words are Adrian's (2026-10-24, 11:56): „Recente întâi" ⇄ „Vechi întâi", and its hover says what the order is
 * by. Once a column sorts (40.47) it reads „Ordonat după „<the column's short name>”". Secondary and sm, like the
 * toolbar's other buttons since 40.30 (Ask first 3).
 */
import { ArrowDownWideNarrow, ArrowUpNarrowWide } from "lucide-react";
import { useTranslations } from "next-intl";
import { IconButton } from "@/lib/ui/icon-button";
import { CHANGED, flipListOrder, type ListOrder } from "@/lib/list/list-order";

export function ListSortButton({
  order,
  onChange,
  columnName,
}: {
  order: ListOrder;
  onChange: (next: ListOrder) => void;
  /** The short name of the column a sort names (40.47); the key itself when there is none. */
  columnName?: (sort: string) => string;
}) {
  const t = useTranslations("shared.sort");
  const byChanged = order.sort === CHANGED;
  const label = byChanged
    ? t(order.order === "desc" ? "recent" : "older")
    : t("sortedBy", { column: columnName?.(order.sort) ?? order.sort });
  return (
    <IconButton
      icon={order.order === "asc" ? ArrowUpNarrowWide : ArrowDownWideNarrow}
      label={label}
      note={byChanged ? t("changedHint") : t("backHint")}
      showLabel
      variant="secondary"
      size="sm"
      data-sort-control=""
      data-sort={`${order.sort}:${order.order}`}
      onClick={() => onChange(flipListOrder(order))}
    />
  );
}
