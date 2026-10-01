"use client";

/**
 * An „Asociază …" screen as a row of unit tiles.               (Slice #37.34)
 *
 * Căutare holds the search boxes, Rezultate the results table filling its
 * tile, Asociere the role, any values, and „Asociază selecția" / „Înapoi".
 * On a wide window the three sit side by side, so the role and the button are
 * in view beside a long list instead of under it; on a narrow one they wrap,
 * in reading order. The row is whole units (`screenRowStyle`), every tile too
 * (`unitStyle`), and `expectUnitGrid` reads them as it reads a detail screen.
 */
import { useEffect, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useNavigationHistory } from "@/components/providers/navigation-history-provider";
import { UnitRow } from "@/components/screen/unit-row";
import { unitStyle } from "@/lib/ui/field-widths";

export type AssociateTileName = "search" | "results" | "association";

/** The row: as many whole units as the window holds, never fewer than its widest tile (`UnitRow`). */
export function AssociateRow({ units, children }: { units: readonly number[]; children: ReactNode }) {
  return <UnitRow units={units}>{children}</UnitRow>;
}

/** One tile, titled with its name, `units` wide; its height follows its content. */
export function AssociateTile({ tile, units, children }: { tile: AssociateTileName; units: number; children: ReactNode }) {
  const t = useTranslations("shared.associateTiles");
  return (
    <section
      aria-label={t(tile)}
      data-tile={tile}
      style={unitStyle(units)}
      className="flex flex-col gap-3 rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink dark:text-zinc-400">{t(tile)}</h2>
      {children}
    </section>
  );
}

/**
 * The record's crumb, from the screen itself: opened from an address rather
 * than from the record, the breadcrumb still reads Acasă › list › record ›
 * this screen. A label only — the screen is not a visit to the record.
 */
export function useRecordCrumb(href: string, label: string) {
  const { registerPage } = useNavigationHistory();
  useEffect(() => {
    if (label) registerPage(href, label);
  }, [registerPage, href, label]);
}
