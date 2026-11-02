/**
 * Slice 41.39 — Adrian: „For the “Tags and groups” tile once I click on the groups dropdown the tile freezes: if I click
 * out of the drop The drop down doesn't come back to closed, it stays open; Also I cannot resize the tile".
 *
 * Etichete și grupuri's group and stamp pickers (entity-metadata-tab.tsx) close on a press outside their section and on
 * Esc — the outside-press rule the app's popovers follow — and their options are cut so that no long description widens
 * the tile (the box takes what is left of its row; the whole description is each option's title).
 */
import { useEffect, type RefObject } from "react";

/** About 60 characters of a description after the code, „…" where it was cut (Ask first 2). */
export const PICKER_DESCRIPTION_CHARS = 60;

/** An option's words: the code, a dash, the description cut at a word where it can be. */
export function pickerOptionText(code: string, description: string | null | undefined, max = PICKER_DESCRIPTION_CHARS): string {
  const d = (description ?? "").trim();
  if (d.length <= max) return d ? `${code} — ${d}` : code;
  const cut = d.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${code} — ${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/**
 * While `open`, a pointerdown outside `scope` closes the picker, and so does Esc — then the focus goes back to
 * `focusBack` (its „+"), so the keyboard is not lost. A press inside (the „+" itself, the box) is left alone.
 */
export function usePickerDismiss(
  open: boolean,
  close: () => void,
  scope: RefObject<HTMLElement | null>,
  focusBack?: () => HTMLElement | null | undefined,
): void {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const root = scope.current;
      if (root && e.target instanceof Node && !root.contains(e.target)) close();
    };
    // Captured, and marked handled: this Esc closes the picker only — the tile around it (41.40's edit, which leaves on
    // Esc through `onTileKeyDown`) sees it handled and stays open.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      e.preventDefault();
      close();
      focusBack?.()?.focus();
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open, close, scope, focusBack]);
}
