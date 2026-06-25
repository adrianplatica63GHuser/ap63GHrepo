/**
 * Code-side registry for the on-screen Help system (Slice #16.UX.02).
 *
 * This is the single source of truth for which screens may show a
 * <HelpButton> (Background + How-To popover) and which micro-hint slots
 * exist (<HelpHint>, for hidden mouse/keyboard behaviour). DB rows in
 * help_content / help_hint only ever *supply content* for an entry that
 * already exists here — a registry entry with no matching DB row renders
 * nothing (no button, no hint), and a DB row whose screenKey/hintKey is not
 * registered here is ignored by the UI (it can still be cleaned up later
 * from the Admin screen, which lists orphaned rows separately).
 *
 * Maintained by Claude as part of normal slice work — never auto-discovered
 * from the page tree. Add an entry here whenever a new screen should be
 * eligible for help content, then let Adrian fill in the actual text via
 * Administration -> Help Content.
 */

export const HELP_SCREENS = [
  { key: "properties-list", label: "Properties — List" },
  { key: "property-detail", label: "Properties — Detail" },
  { key: "properties-map", label: "Properties — Map" },
  { key: "documents-list", label: "Documents — List" },
  { key: "document-detail", label: "Documents — Detail" },
  { key: "persons-list", label: "Persons — List" },
  { key: "natural-person-detail", label: "Persons — Natural Person Detail" },
  { key: "judicial-person-detail", label: "Persons — Judicial Person Detail" },
  { key: "admin-value-lists", label: "Administration — Reference Data" },
  { key: "admin-import", label: "Administration — Import" },
] as const;

export type HelpScreenKey = (typeof HELP_SCREENS)[number]["key"];

export function isHelpScreenKey(key: string): key is HelpScreenKey {
  return HELP_SCREENS.some((s) => s.key === key);
}

export function helpScreenLabel(key: string): string {
  return HELP_SCREENS.find((s) => s.key === key)?.label ?? key;
}

// ---------------------------------------------------------------------------
// Micro-hints — hidden mouse/keyboard behaviour on a handful of screens.
// Each hint belongs to a screen (screenKey) and has its own slot key
// (hintKey), since a screen could in principle carry more than one.
// ---------------------------------------------------------------------------

export const HELP_HINTS = [
  {
    screenKey: "properties-map",
    hintKey: "drag-select",
    label: "Drag-to-select rectangle (batch delete)",
  },
  {
    screenKey: "document-detail",
    hintKey: "big-page-zoom",
    label: "Wheel-zoom / click-drag pan (Show Big Page)",
  },
  {
    screenKey: "admin-import",
    hintKey: "ocr-extract",
    label: "Extract fields from a scanned ID card image",
  },
] as const satisfies readonly { screenKey: HelpScreenKey; hintKey: string; label: string }[];

export type HelpHintKey = (typeof HELP_HINTS)[number]["hintKey"];

export function isHelpHint(screenKey: string, hintKey: string): boolean {
  return HELP_HINTS.some((h) => h.screenKey === screenKey && h.hintKey === hintKey);
}

export function helpHintLabel(screenKey: string, hintKey: string): string {
  return (
    HELP_HINTS.find((h) => h.screenKey === screenKey && h.hintKey === hintKey)?.label ??
    hintKey
  );
}

export function helpHintsForScreen(screenKey: string) {
  return HELP_HINTS.filter((h) => h.screenKey === screenKey);
}
