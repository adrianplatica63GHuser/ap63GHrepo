"use client";

/**
 * „Folosințe permise pentru fiecare tip" — the third tile of „Tipuri de Proprietate și Folosințe".   (Slice #39.66)
 *
 * A grid: a row per property type, a column per use category, a tick where the type allows the use. Each tick is
 * written at once (PUT /api/admin/property-type-uses), as the role panel's ticks are. ⚠️ A ROW WITH NO TICK ALLOWS
 * EVERY USE — the row says „toate" — so unticking a type's last use opens it to all of them rather than to none
 * (src/lib/properties/type-uses.ts). The property form reads the same pairs, under the same query key.
 *
 * The two lists are read under the keys their own tiles use, so a type or a use added in the tile above appears here
 * as soon as that tile's write lands.
 */
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { dialogCardStyle } from "@/lib/ui/field-widths";
import { typeUsesUnits } from "@/lib/admin/value-lists/reference-tiles";
import { TYPE_USES_QUERY_KEY, fetchTypeUses, setTypeUse, type TypeUsePair } from "@/lib/properties/type-uses";
import { fetchValueListRows, toLookupItems } from "./role-doc-types";
import { COLUMN_NAMES_FACE } from "@/lib/ui/title-type";

/** The grid's frame: `px-5` either side (Slice #39.88 — with the card's border, the standard 21-px gap). */
const TYPE_USES_PAD_PX = 20;
/** „Tip"'s column's own right padding (`pr-3`), to which the width the grid gains in a tile is added. */
const TYPE_USES_NAME_PAD_PX = 12;

export function PropertyTypeUses({
  cardUnits,
  fill = false,
  onUnits,
}: {
  cardUnits: number;
  /** Slice #39.75: a tile's card, as wide as its tile; the table centred in it, so the gaps either side are equal. */
  fill?: boolean;
  /** Slice #39.75: the units the table needs, each time its width changes (a use added or renamed). */
  onUnits?: (units: number) => void;
}) {
  const t = useTranslations("valueList.typeUses");
  const qc = useQueryClient();
  const types = useQuery({ queryKey: ["value-list", "property-types"], queryFn: () => fetchValueListRows("property-types"), select: toLookupItems });
  const uses = useQuery({ queryKey: ["value-list", "use-categories"], queryFn: () => fetchValueListRows("use-categories"), select: toLookupItems });
  const pairs = useQuery({ queryKey: TYPE_USES_QUERY_KEY, queryFn: fetchTypeUses });
  const [error, setError] = useState(false);
  // The tick shows the click at once, before the PUT and the refetch land (#37.59's lesson).
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const save = useMutation({
    mutationFn: setTypeUse,
    onMutate: (v) => {
      setError(false);
      setPending((p) => ({ ...p, [`${v.propertyTypeId}:${v.useCategoryId}`]: v.allowed }));
    },
    onError: () => setError(true),
    onSettled: async (_d, _e, v) => {
      await qc.invalidateQueries({ queryKey: TYPE_USES_QUERY_KEY });
      setPending((p) => {
        const n = { ...p };
        delete n[`${v.propertyTypeId}:${v.useCategoryId}`];
        return n;
      });
    },
  });

  const allowed = (pair: TypeUsePair): boolean => {
    const k = `${pair.propertyTypeId}:${pair.useCategoryId}`;
    if (k in pending) return pending[k];
    return (pairs.data ?? []).some((p) => p.propertyTypeId === pair.propertyTypeId && p.useCategoryId === pair.useCategoryId);
  };

  const loading = types.isPending || uses.isPending || pairs.isPending;

  // Slice #39.75: the table at its own width (`max-content`), measured whenever it changes, tells the tile its units.
  // Slice #39.88: in a tile the grid then fills it to the standard gap (21 px), the width it gains going to „Tip" — the
  // type's name (Ask first 2). That extra is a padding on every cell of the name's column — a column is as wide as its
  // widest cell, so on the header alone it changed nothing — and the table's own width is what it reads
  // less the extra, and the units never follow the extra round.
  const tableRef = useRef<HTMLTableElement | null>(null);
  const extraRef = useRef(0);
  const [extra, setExtra] = useState(0);
  const namePad = fill && extra > 0 ? { paddingRight: TYPE_USES_NAME_PAD_PX + extra } : undefined;
  useEffect(() => {
    const el = tableRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const report = () => {
      if (el.offsetWidth <= 0) return;
      const own = el.offsetWidth - extraRef.current;
      onUnits?.(typeUsesUnits(own));
      if (!fill || !el.parentElement) return;
      const inner = el.parentElement.clientWidth - 2 * TYPE_USES_PAD_PX;
      const next = Math.max(0, Math.floor(inner - own));
      if (Math.abs(next - extraRef.current) >= 1) {
        extraRef.current = next;
        setExtra(next);
      }
    };
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    if (el.parentElement) ro.observe(el.parentElement);
    return () => ro.disconnect();
  }, [onUnits, loading, fill]);

  return (
    <section
      className="rounded-xl border border-card-rim bg-card shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      style={fill ? { width: "100%" } : dialogCardStyle(cardUnits)}
      data-property-type-uses=""
      aria-labelledby="property-type-uses-title"
    >
      <div className="border-b border-card-rim px-5 py-3 dark:border-zinc-800">
        <h2 id="property-type-uses-title" className="text-base font-semibold text-ink dark:text-zinc-100">{t("title")}</h2>
        <p className="mt-1 text-xs text-fade dark:text-zinc-400">{t("hint")}</p>
      </div>
      <div className={`overflow-x-auto px-5 ${fill ? "pb-5 pt-3" : "py-3"}`} data-type-uses-frame="">
        {loading ? (
          <p className="text-sm text-fade" role="status">{t("loading")}</p>
        ) : (
          <table ref={tableRef} className={fill ? "w-max text-sm" : "text-sm"}>
            <thead>
              <tr>
                <th
                  className={`py-1 pr-3 text-left ${COLUMN_NAMES_FACE}`}
                  style={namePad}
                  data-type-uses-name=""
                >
                  {t("colType")}
                </th>
                {(uses.data ?? []).map((u) => (
                  <th key={u.id} className={`px-1 py-1 ${COLUMN_NAMES_FACE}`} data-use-column={u.name}>
                    <span className="inline-block max-w-[6rem] whitespace-normal">{u.name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(types.data ?? []).map((ty) => {
                const any = (uses.data ?? []).some((u) => allowed({ propertyTypeId: ty.id, useCategoryId: u.id }));
                return (
                  <tr key={ty.id} className="border-t border-wire dark:border-zinc-700" data-type-row={ty.name}>
                    <td className="whitespace-nowrap py-1 pr-3 font-medium text-ink dark:text-zinc-100" style={namePad}>
                      {ty.name}
                      {!any && <span className="ml-2 text-xs italic text-fade" data-allows-all="">({t("allowsAll")})</span>}
                    </td>
                    {(uses.data ?? []).map((u) => {
                      const pair = { propertyTypeId: ty.id, useCategoryId: u.id };
                      return (
                        <td key={u.id} className="px-1 py-1 text-center">
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={allowed(pair)}
                            onChange={(e) => save.mutate({ ...pair, allowed: e.target.checked })}
                            aria-label={t("tick", { use: u.name, type: ty.name })}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {error && <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">{t("saveError")}</p>}
      </div>
    </section>
  );
}
