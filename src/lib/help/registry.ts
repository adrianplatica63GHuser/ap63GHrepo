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
 *   2. Add its name to `help.admin.screens.<key>` in BOTH message files.
 *   3. Map its route in src/lib/help/route-map.ts.
 *   4. That's it — <HelpButton> is auto-mounted in the breadcrumb bar for
 *      every resolvable route. There is no per-page wiring.
 *
 * Step 2 is not optional and it is not cosmetic: with no message, the admin
 * list renders the raw key path at the user. `help-coverage.test.ts` fails
 * when an entry here has no message in either locale, so a forgotten step 2
 * is a red suite rather than a screen nobody looks at closely.
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
  { key: "dashboard" },

  // ── Properties ──────────────────────────────────────────────────────────
  { key: "properties-list" },
  { key: "property-detail" },
  { key: "properties-map" },

  // ── Documents ───────────────────────────────────────────────────────────
  { key: "documents-list" },
  { key: "document-detail" },

  // ── Persons ─────────────────────────────────────────────────────────────
  { key: "natural-persons-list" },
  { key: "natural-person-detail" },
  { key: "judicial-persons-list" },
  { key: "judicial-person-detail" },

  // ── Association sub-pages ───────────────────────────────────────────────
  // Deliberately generic: the same five screens are reached from Property,
  // Document and both Person types, and the instructions are identical
  // regardless of which entity you arrived from. One key each, not one per
  // (entity x association) pair.
  { key: "associate-person" },
  { key: "associate-document" },
  { key: "associate-property" },
  { key: "associate-reference" },
  { key: "associate-party" },

  // ── Administration ──────────────────────────────────────────────────────
  { key: "admin-value-lists" },
  { key: "admin-import" },
  // Slice #29.09. Registered rather than opted out: a screen that spends money
  // on twenty model reads and then writes a form every future document of a
  // type is read against is the opposite of self-evident.
  { key: "admin-doc-type-engine" },
  { key: "admin-calculation" },
  { key: "admin-calculation-history" },
  { key: "admin-calculation-run" },
  { key: "admin-groups" },
  { key: "admin-group-editor" },
  { key: "admin-stamps" },
  { key: "admin-stamp-applicator" },
  { key: "admin-tags" },
  { key: "admin-settings" },
  { key: "admin-users" },
  { key: "admin-global-search" },
  { key: "admin-help-content" },
] as const;

export type HelpScreenKey = (typeof HELP_SCREENS)[number]["key"];

export function isHelpScreenKey(key: string): key is HelpScreenKey {
  return HELP_SCREENS.some((s) => s.key === key);
}

/**
 * The message key path — under the `help.admin` namespace — that carries this
 * screen's human-readable name.
 *
 * Slice #32.16: the names used to live in the array above, in English, and
 * were rendered as-is, so the Romanian Help Information screen listed thirty
 * entries reading „Persons — Natural Person List". They are messages now.
 *
 * This returns the KEY and not the text: resolving it needs a translator, and
 * this module is imported by tests, by API routes and by the route map — none
 * of which are React renders. The one caller that needs the text
 * (`help-content-hub.tsx`) already has a `useTranslations("help.admin")`.
 *
 * ⚠️ `key` itself is untouched by all of this. It is a foreign key into
 * `help_content.screenKey` / `help_hint.screenKey`, it is matched by
 * `route-map.ts`, and `help-coverage.test.ts` reads it — only the label moved.
 */
export function helpScreenLabelKey(key: string): string {
  return `screens.${key}`;
}

// ---------------------------------------------------------------------------
// Micro-hints — hidden mouse/keyboard behaviour.
// ---------------------------------------------------------------------------
//
// A hint declares the screen(s) it appears on via `screens`, and its display
// name lives at `help.admin.hints.<hintKey>` in both message files (see
// `helpHintLabelKey`). Several hints genuinely belong to more than one screen
// (the four list views share their selection behaviour; the property form is
// reached from two routes), and storing one DB row per (screen, hint) would
// otherwise force the same text to be typed once per screen. The Admin editor
// shows ONE entry per hintKey and fans the save out to every screen in
// `screens`, so the text is authored once.
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
  },
  {
    hintKey: "ruler-two-clicks",
    screens: ["properties-map"],
  },
  {
    hintKey: "angles-click-corner",
    screens: ["properties-map"],
  },
  {
    hintKey: "map-double-click-open",
    screens: ["properties-map"],
  },
  {
    hintKey: "map-blinking-duplicates",
    screens: ["properties-map"],
  },
  {
    hintKey: "map-selected-tab",
    screens: ["properties-map"],
  },

  // ── Property form (detail + new) ────────────────────────────────────────
  {
    hintKey: "corner-reorder",
    screens: ["property-detail"],
  },
  {
    hintKey: "map-draw-corners",
    screens: ["property-detail"],
  },
  {
    hintKey: "map-close-polygon",
    screens: ["property-detail"],
  },
  {
    hintKey: "map-drag-corner",
    screens: ["property-detail"],
  },
  {
    hintKey: "calculated-area-auto",
    screens: ["property-detail"],
  },
  {
    hintKey: "street-view-fetch-address",
    screens: ["property-detail"],
  },

  // ── Document form (detail + new) ────────────────────────────────────────
  {
    hintKey: "big-page-zoom",
    screens: ["document-detail"],
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
  },

  // ── Groups ──────────────────────────────────────────────────────────────
  {
    hintKey: "group-staged-members",
    screens: ["admin-group-editor"],
  },
  {
    hintKey: "group-pending-position",
    screens: ["admin-group-editor"],
  },

  // ── Stamps ──────────────────────────────────────────────────────────────
  {
    hintKey: "stamp-staged-changes",
    screens: ["admin-stamp-applicator"],
  },
  {
    hintKey: "stamp-type-switch-keeps-changes",
    screens: ["admin-stamp-applicator"],
  },

  // ── Calculation ─────────────────────────────────────────────────────────
  {
    hintKey: "calc-file-format",
    screens: ["admin-calculation"],
  },
  {
    hintKey: "calc-preview-not-saved",
    screens: ["admin-calculation"],
  },
  {
    hintKey: "calc-group-description-autofill",
    screens: ["admin-calculation"],
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
  },
] as const satisfies readonly {
  hintKey: string;
  screens: readonly HelpScreenKey[];
}[];

export type HelpHintKey = (typeof HELP_HINTS)[number]["hintKey"];

/** True when this hintKey is registered for this screen. */
export function isHelpHint(screenKey: string, hintKey: string): boolean {
  return HELP_HINTS.some(
    (h) => h.hintKey === hintKey && (h.screens as readonly string[]).includes(screenKey),
  );
}

/** As `helpScreenLabelKey`, for a micro-hint. `hintKey` is likewise an FK. */
export function helpHintLabelKey(hintKey: string): string {
  return `hints.${hintKey}`;
}

/** Every hint registered for a given screen. */
export function helpHintsForScreen(screenKey: string) {
  return HELP_HINTS.filter((h) => (h.screens as readonly string[]).includes(screenKey));
}

/** Every (screenKey, hintKey) pair a hint expands to — used by the admin save fan-out. */
export function helpHintScreens(hintKey: string): readonly string[] {
  return HELP_HINTS.find((h) => h.hintKey === hintKey)?.screens ?? [];
}
