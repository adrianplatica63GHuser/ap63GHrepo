"use client";

/**
 * The record's name in a list row, as a real link.                                                     (Slice 40.60)
 *
 * Adrian, 2026-10-24 (GA40-Design-Improvements.docx, chapter 4c): „I fully accept your recommendation; please make the
 * name in the first cell a real link". The „Deschide" arrow left the rows of the four lists; the name took its place
 * as the way in. Tab reaches it and Enter opens the record, and Ctrl/⌘+click, a middle-click, Shift+click and the
 * browser's own „open in new tab" open it elsewhere, as the arrow's `<a href>` did (#37.21).
 *
 * A plain click is NOT the link's: it is left to the row, whose own click opens the record — so a click on the name and
 * a click beside it do the same thing, through the same code. Every other click is the browser's, and the row is not
 * told (it would open a second tab, `newTabIfAsked`).
 *
 * It looks as the text did (Ask first 1): no colour of its own, no underline at rest; underlined on hover and in focus.
 * An empty name („—") is named „Deschide" for a screen reader, so the link never reads as a dash.
 */
import type { MouseEvent, ReactNode } from "react";

export function RowNameLink({ href, children, emptyLabel }: { href: string; children: ReactNode; emptyLabel?: string }) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) {
      e.stopPropagation();
      return;
    }
    e.preventDefault();
  };
  return (
    <a
      href={href}
      onClick={onClick}
      onAuxClick={(e) => e.stopPropagation()}
      aria-label={emptyLabel}
      className="rounded-sm text-inherit no-underline underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus"
      data-row-name-link=""
    >
      {children}
    </a>
  );
}
