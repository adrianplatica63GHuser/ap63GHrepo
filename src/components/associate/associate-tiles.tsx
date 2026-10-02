"use client";

/**
 * An „Asociază …" screen as a row of unit tiles.               (Slice #37.34)
 *
 * Căutare holds the search boxes, Rezultate the results table filling its
 * tile, Asociere the role, any values, and „Asociază selecția" / „Înapoi".
 *
 * Slice #37.58: the three stand ONE UNDER ANOTHER, their left edges aligned at
 * the left of the screen, each at its own width — at every window, on every
 * association screen (they sat side by side before). Asociere comes last in
 * the page and in the tab order, as before, but it is STICKY to the bottom of
 * the window, so its buttons stay in reach over a long page of results; it
 * settles in its own place once the page is scrolled to it.
 *
 * The row is whole units (`screenRowStyle`), every tile too (`unitStyle`), and
 * `expectUnitGrid` reads them as it reads a detail screen.
 */
import { useEffect, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useNavigationHistory } from "@/components/providers/navigation-history-provider";
import { PANEL_GAP, screenRowStyle, unitStyle } from "@/lib/ui/field-widths";

export type AssociateTileName = "search" | "results" | "association";

/** Asociere's buttons stay in reach: it keeps to the window's bottom edge until its own place comes into view (#37.58). */
const STICKY = " sticky bottom-0 z-10 shadow-md";

/**
 * The screen's tiles, one under another at the left (#37.58): the row is as many
 * whole units as the window holds, never fewer than its widest tile, and its
 * tiles a left-aligned column inside it.
 */
export function AssociateRow({ units, children }: { units: readonly number[]; children: ReactNode }) {
  return (
    <div style={screenRowStyle(Math.max(...units))}>
      <div className="flex flex-col items-start" style={{ gap: PANEL_GAP }} data-tile-row data-tile-stack>
        {children}
      </div>
    </div>
  );
}

/** One tile, titled with its name, `units` wide; its height follows its content. */
export function AssociateTile({ tile, units, children }: { tile: AssociateTileName; units: number; children: ReactNode }) {
  const t = useTranslations("shared.associateTiles");
  return (
    <section
      aria-label={t(tile)}
      data-tile={tile}
      style={unitStyle(units)}
      className={`flex flex-col gap-3 rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900${tile === "association" ? STICKY : ""}`}
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
