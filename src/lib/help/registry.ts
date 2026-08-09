/**
 * Code-side registry for the on-screen Help system.
 *
 * Slice #16.UX.02 created this; Slice #21.10.help.rollout expanded it from 11
 * screens to the full application surface and made the whole thing self-
 * policing (see src/lib/help/route-map.ts and the tests in
 * src/__tests__/help-coverage.test.ts).
 *
 * This is the single source of truth for which screens may show a
 * <HelpButton> (Background + How-To popover) and which micro-hint slots exist
 * (<HelpHint>, for hidden mouse/keyboard behaviour). DB rows in help_content /
 * help_hint only ever *supply content* for an entry that already exists here —
 * a registry entry with no matching DB row renders nothing (no button, no
 * hint), and a DB row whose screenKey/hintKey is not registered here is
 * ignored by the UI.
 *
 * HOW A SCREEN GETS HELP
 *   1. Add an entry to HELP_SCREENS below.
 *   2. Map its route in src/lib/help/route-map.ts.
 *   3. That's it — <HelpButton> is auto-mounted in the breadcrumb bar for
 *      every resolvable route. There is no per-page wiring.
 *
 * A route that resolves to no screen key AND is not listed in HELP_OPTED_OUT
 * (route-map.ts) fails the coverage test, so a new screen cannot ship without
 * a deliberate decision about its help.
 *
 * WHY /new SHARES ITS DETAIL SCREEN'S KEY
 *   /properties/new and /properties/[id] render the same form component, so a
 *   <HelpHint> inside that component cannot tell which route it is on. They
 *   therefore share one key. The same applies to documents and both person
 *   subtypes.
 */

export const HELP_SCREENS = [
  // ── Home ────────────────────────────────────────────────────────────────
  { key: "dashboard", label: "Home — Dashboard" },

  // ── Properties ──────────────────────────────────────────────────────────
  { key: "properties-list", label: "Properties — List" },
  { key: "property-detail", label: "Properties — Detail / New" },
  { key: "properties-map", label: "Properties — Map" },

  // ── Documents ───────────────────────────────────────────────────────────
  { key: "documents-list", label: "Documents — List" },
  { key: "document-detail", label: "Documents — Detail / New" },

  // ── Persons ─────────────────────────────────────────────────────────────
  { key: "natural-persons-list", label: "Persons — Natural Person List" },
  { key: "natural-person-detail", label: "Persons — Natural Person Detail / New" },
  { key: "judicial-persons-list", label: "Persons — Judicial Person List" },
  { key: "judicial-person-detail", label: "Persons — Judicial Person Detail / New" },

  // ── Association sub-pages ───────────────────────────────────────────────
  // Deliberately generic: the same five screens are reached from Property,
  // Document and both Person types, and the instructions are identical
  // regardless of which entity you arrived from. One key each, not one per
  // (entity x association) pair.
  { key: "associate-person", label: "Associate — Person" },
  { key: "associate-document", label: "Associate — Document" },
  { key: "associate-property", label: "Associate — Property" },
  { key: "associate-reference", label: "Associate — Reference (same type)" },
  { key: "associate-party", label: "Associate — Document party (with role)" },

  // ── Administration ──────────────────────────────────────────────────────
  { key: "admin-value-lists", label: "Administration — Reference Data" },
  { key: "admin-import", label: "Administration — Import" },
  { key: "admin-calculation", label: "Administration — Calculation" },
  { key: "admin-calculation-history", label: "Administration — Calculation History" },
  { key: "admin-calculation-run", label: "Administration — Calculation Run Detail" },
  { key: "admin-groups", label: "Administration — Groups List" },
  { key: "admin-group-editor", label: "Administration — Group Editor" },
  { key: "admin-stamps", label: "Administration — Stamps List" },
  { key: "admin-stamp-applicator", label: "Administration — Stamp Applicator" },
  { key: "admin-tags", label: "Administration — Tags" },
  { key: "admin-settings", label: "Administration — Settings" },
  { key: "admin-users", label: "Administration — Users & Access" },
  { key: "admin-global-search", label: "Administration — Global Search" },
  { key: "admin-help-content", label: "Administration — Help Content" },
] as const;

export type HelpScreenKey = (typeof HELP_SCREENS)[number]["key"];

export function isHelpScreenKey(key: string): key is HelpScreenKey {
  return HELP_SCREENS.some((s) => s.key === key);
}

export function helpScreenLabel(key: string): string {
  return HELP_SCREENS.find((s) => s.key === key)?.label ?? key;
}

// ---------------------------------------------------------------------------
// Micro-hints — hidden mouse/keyboard behaviour.
// ---------------------------------------------------------------------------
//
// A hint declares the screen(s) it appears on via `screens`. Several hints
// genuinely belong to more than one screen (the four list views share their
// selection behaviour; the property form is reached from two routes), and
// storing one DB row per (screen, hint) would otherwise force the same text
// to be typed once per screen. The Admin editor shows ONE entry per hintKey
// and fans the save out to every screen in `screens`, so the text is authored
// once.
//
// SELECTION CRITERIA — a hint earns its lightbulb only when not knowing costs
// the user something real:
//   - silent data loss or overwrite
//   - a feature that is otherwise undiscoverable
//   - invisible state (something is staged, pending, or not yet saved)
// Conventional behaviour (Escape closes, Enter saves, backdrop closes, hover
// highlights) is deliberately NOT hinted — a lightbulb on every control trains
// users to ignore lightbulbs.

export const HELP_HINTS = [
  // ── Properties map ──────────────────────────────────────────────────────
  {
    hintKey: "drag-select",
    screens: ["properties-map"],
    label: "Map — drag a rectangle to select many properties",
  },
  {
    hintKey: "ruler-two-clicks",
    screens: ["properties-map"],
    label: "Map — ruler click sequence and corner snapping",
  },
  {
    hintKey: "angles-click-corner",
    screens: ["properties-map"],
    label: "Map — click a corner to read its angle",
  },
  {
    hintKey: "map-double-click-open",
    screens: ["properties-map"],
    label: "Map — double-click a plot to open it",
  },
  {
    hintKey: "map-blinking-duplicates",
    screens: ["properties-map"],
    label: "Map — blinking pink means duplicate plots",
  },
  {
    hintKey: "map-selected-tab",
    screens: ["properties-map"],
    label: "Map — the 'Display all selected' tab",
  },

  // ── Property form (detail + new) ────────────────────────────────────────
  {
    hintKey: "corner-reorder",
    screens: ["property-detail"],
    label: "Corners — the up/down arrows change the plot shape",
  },
  {
    hintKey: "map-draw-corners",
    screens: ["property-detail"],
    label: "Corners — draw by clicking on the map",
  },
  {
    hintKey: "map-close-polygon",
    screens: ["property-detail"],
    label: "Corners — click the first corner to close the shape",
  },
  {
    hintKey: "map-drag-corner",
    screens: ["property-detail"],
    label: "Corners — drag a corner dot to correct it",
  },
  {
    hintKey: "calculated-area-auto",
    screens: ["property-detail"],
    label: "Calculated Area is derived from the corners",
  },
  {
    hintKey: "street-view-fetch-address",
    screens: ["property-detail"],
    label: "Fetch from Street View overwrites the address box",
  },

  // ── Document form (detail + new) ────────────────────────────────────────
  {
    hintKey: "big-page-zoom",
    screens: ["document-detail"],
    label: "Big Page — wheel to zoom, drag to pan",
  },
  // Slice #26.09 removed "ai-interpret-once". Its placement went with the AI
  // Interpret button — all AI interpretation happens automatically during an
  // import run now — and a registered hint with nowhere to appear is exactly
  // what invariant 2 of help-coverage.test.ts exists to catch.
  {
    hintKey: "ai-party-confirm",
    // Slice #26.09: `AiPartyLinkerDialog` is no longer reachable from a
    // document page — the AI Interpret button that opened it there is gone, and
    // the stepper now runs only from the import's own result dialog. A hint
    // registered against a screen it can never appear on is content an admin
    // can author and nobody can ever read.
    screens: ["admin-import"],
    label: "AI-found people must be confirmed one by one",
  },

  // ── Groups ──────────────────────────────────────────────────────────────
  {
    hintKey: "group-staged-members",
    screens: ["admin-group-editor"],
    label: "Groups — moves are staged until Save group",
  },
  {
    hintKey: "group-pending-position",
    screens: ["admin-group-editor"],
    label: "Groups — '[new]' means the position is not assigned yet",
  },

  // ── Stamps ──────────────────────────────────────────────────────────────
  {
    hintKey: "stamp-staged-changes",
    screens: ["admin-stamp-applicator"],
    label: "Stamps — + / - are staged until Save stamps",
  },
  {
    hintKey: "stamp-type-switch-keeps-changes",
    screens: ["admin-stamp-applicator"],
    label: "Stamps — switching type keeps pending changes",
  },

  // ── Calculation ─────────────────────────────────────────────────────────
  {
    hintKey: "calc-file-format",
    screens: ["admin-calculation"],
    label: "Calculation — the five sections the file must contain",
  },
  {
    hintKey: "calc-preview-not-saved",
    screens: ["admin-calculation"],
    label: "Calculation — nothing is created until you confirm",
  },
  {
    hintKey: "calc-group-description-autofill",
    screens: ["admin-calculation"],
    label: "Calculation — loading a file overwrites the description",
  },

  // ── List views (all four share this) ────────────────────────────────────
  {
    hintKey: "select-all-page-only",
    screens: [
      "properties-list",
      "documents-list",
      "natural-persons-list",
      "judicial-persons-list",
    ],
    label: "Lists — the header tick box only selects the current page",
  },
] as const satisfies readonly {
  hintKey: string;
  screens: readonly HelpScreenKey[];
  label: string;
}[];

export type HelpHintKey = (typeof HELP_HINTS)[number]["hintKey"];

/** True when this hintKey is registered for this screen. */
export function isHelpHint(screenKey: string, hintKey: string): boolean {
  return HELP_HINTS.some(
    (h) => h.hintKey === hintKey && (h.screens as readonly string[]).includes(screenKey),
  );
}

export function helpHintLabel(hintKey: string): string {
  return HELP_HINTS.find((h) => h.hintKey === hintKey)?.label ?? hintKey;
}

/** Every hint registered for a given screen. */
export function helpHintsForScreen(screenKey: string) {
  return HELP_HINTS.filter((h) => (h.screens as readonly string[]).includes(screenKey));
}

/** Every (screenKey, hintKey) pair a hint expands to — used by the admin save fan-out. */
export function helpHintScreens(hintKey: string): readonly string[] {
  return HELP_HINTS.find((h) => h.hintKey === hintKey)?.screens ?? [];
}
