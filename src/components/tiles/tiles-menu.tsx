"use client";

/**
 * „Panouri": the tile bar behind one button, on the four record screens.                              (Slice 40.57)
 *
 * Adrian, 2026-10-24 (GA40-Design-Improvements.docx, chapter 3): „I fully accept your recommendation" — the tile
 * checkboxes, „Toate sus", „Toate" and „Implicit" crowd the top of every record, so they go into a panel behind one
 * button, right after the versions pill; closed, the record goes straight from its name to its data.
 *
 * The state lives here (`useTilesMenu`), the button in the record's header (`TilesMenuButton`), the panel where the bar
 * stood, under the header (`TileSelector`'s `menu`). The panel is a popover over the tiles (Ask first 1): Esc, a press
 * outside it and the button again close it; ticking a box inside it does not. Closed, it stays in the page, hidden, so
 * the bar keeps its measurements and each box its state.
 *
 * The badge (Ask first 3): a small navy count on the button's corner — the hidden tiles that hold a marked field
 * (#37.20), which only a Document has; none when there are none. Inside the panel the dot stays beside its tile's name.
 * Setări's and the home page's bars stay open, as they were.
 */
import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, LayoutGrid } from "lucide-react";

import { buttonClass } from "@/lib/ui/button-styles";
import { LeadingIcon, TrailingIcon } from "@/lib/ui/icon-button";

export type TilesMenu = {
  open: boolean;
  setOpen: (open: boolean) => void;
  /** The panel's id, for the button's `aria-controls`; with the button's, how a press is told inside from outside. */
  panelId: string;
  buttonId: string;
};

/** The panel's open state, and what closes it: Esc, a press outside the button and the panel. */
export function useTilesMenu(): TilesMenu {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonId = `${panelId}-button`;
  useEffect(() => {
    if (!open) return;
    const inside = (target: EventTarget | null): boolean =>
      target instanceof Node &&
      (!!document.getElementById(buttonId)?.contains(target) || !!document.getElementById(panelId)?.contains(target));
    const onDown = (e: PointerEvent) => {
      if (!inside(e.target)) setOpen(false);
    };
    // Bubbling, so the tiles diagram's own Esc — which cancels a rectangle being dragged and stops there — comes first.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      if (inside(document.activeElement)) document.getElementById(buttonId)?.focus();
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, panelId, buttonId]);
  return { open, setOpen, panelId, buttonId };
}

/** How many tiles are hidden yet hold a marked field — the badge's count. A tile the record cannot show never counts. */
export function hiddenMarked<K extends string>(
  marked: readonly K[],
  shown: readonly K[],
  disabled?: Readonly<Partial<Record<K, string>>>,
): number {
  return marked.filter((k) => !shown.includes(k) && disabled?.[k] === undefined).length;
}

/** The „Panouri" button: Lucide's LayoutGrid, the word, a chevron; secondary, sm; the badge on its corner. Its word
 *  stands between a `LeadingIcon` and a `TrailingIcon`, which is how the text-controls guard lets a button keep words. */
export function TilesMenuButton({ menu, badge = 0 }: { menu: TilesMenu; badge?: number }) {
  const t = useTranslations("shared.tiles");
  const badgeId = useId();
  return (
    <span className="pointer-events-auto relative inline-flex shrink-0">
      <button
        id={menu.buttonId}
        type="button"
        aria-expanded={menu.open}
        aria-controls={menu.panelId}
        aria-describedby={badge > 0 ? badgeId : undefined}
        onClick={() => menu.setOpen(!menu.open)}
        className={buttonClass({ variant: "secondary", size: "sm" })}
        data-tiles-menu-button=""
      >
        {/* The words with their icons, as the text-controls guard allows a text button (#37.46). */}
        <LeadingIcon icon={LayoutGrid} />
        {t("panels")}
        <TrailingIcon icon={ChevronDown} />
      </button>
      {badge > 0 && (
        <>
          <span
            aria-hidden="true"
            title={t("panelsMarked", { count: badge })}
            data-tiles-menu-badge={badge}
            className="absolute -right-2 -top-2 inline-flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-navy px-1 text-xs font-semibold leading-none text-white dark:bg-[#BFDBFE] dark:text-zinc-900"
          >
            {badge}
          </span>
          <span id={badgeId} className="sr-only">
            {t("panelsMarked", { count: badge })}
          </span>
        </>
      )}
    </span>
  );
}
