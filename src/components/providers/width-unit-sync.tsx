"use client";

/**
 * Slice 41.16 (Ask first 4, lazy): a screen takes the unit saved on „Setări" — in this tab or in another — the next
 * time it is displayed. On every navigation, and when the tab comes back into view, <html>'s `--unit` is brought in
 * line with this browser's cookie; a screen already on view in another tab keeps its unit until then. Nothing is
 * reloaded: every unit width is an expression of `--unit` (field-widths.ts), so the redraw is the browser's.
 */
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { drawWidthUnit, drawnWidthUnit, readWidthUnit } from "@/lib/ui/width-unit";

function sync(): void {
  try {
    const saved = readWidthUnit();
    if (saved !== drawnWidthUnit()) drawWidthUnit(saved);
  } catch {
    // No document cookie to read (a sandboxed frame): the page keeps the unit it was drawn with.
  }
}

export function WidthUnitSync() {
  const pathname = usePathname();
  useEffect(sync, [pathname]);
  useEffect(() => {
    const shown = () => {
      if (document.visibilityState === "visible") sync();
    };
    document.addEventListener("visibilitychange", shown);
    return () => document.removeEventListener("visibilitychange", shown);
  }, []);
  return null;
}
