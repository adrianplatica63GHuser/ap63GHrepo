/**
 * A row that opens a record is a real link.                    (Slice #37.21)
 *
 * Every row of a list or an association tile opens a record. Its open button
 * („Deschide" on a list, „Vizualizare" on a tile) is an `<a href>` now, so
 * Ctrl+click, middle-click and the browser's own „Deschide linkul într-o filă
 * nouă" open the record in a new tab — which Adrian can drag onto another
 * monitor. The row itself follows suit: Ctrl/⌘+click or a middle-click on it
 * opens the same address in a new tab. A plain click and a double-click do what
 * they did (select the row, open the record here).
 *
 * An association row's address carries `?readonly=true`, as its double-click
 * always has, so a second window opens as a viewer and „Modifică" is one click
 * away.
 */
import type { MouseEvent } from "react";

/** A person's screen, by its type — the address every association row of a person opens. */
export function personPath(type: string | null | undefined, id: string): string {
  return `${type === "NATURAL" ? "/natural-persons" : "/judicial-persons"}/${encodeURIComponent(id)}`;
}

/**
 * Open `href` in a new tab when the click asks for one — Ctrl or ⌘ held, or
 * the middle button — and say so, so the caller skips what a plain click does.
 */
export function newTabIfAsked(e: MouseEvent, href: string): boolean {
  if (!(e.ctrlKey || e.metaKey || e.button === 1)) return false;
  e.preventDefault();
  e.stopPropagation();
  window.open(href, "_blank", "noopener");
  return true;
}
