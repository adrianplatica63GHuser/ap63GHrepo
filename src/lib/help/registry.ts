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
 *   1. Add an entry to HELP_SCREENS below, with the id of the manual section
 *      that describes the screen (`manual`, Slice #39.40).
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
  { key: "dashboard", manual: "intro-purpose" },

  // ── Properties ──────────────────────────────────────────────────────────
  { key: "properties-list", manual: "properties-list" },
  { key: "property-detail", manual: "properties-add" },
  { key: "properties-map", manual: "map-what" },
  // Slice #39.67: the tarlale — a list and a page of their own.
  { key: "tarla-list", manual: "properties-tarla" },
  { key: "tarla-detail", manual: "properties-tarla" },

  // ── Documents ───────────────────────────────────────────────────────────
  { key: "documents-list", manual: "documents-list" },
  { key: "document-detail", manual: "documents-add" },

  // ── Interacțiuni (Slice #38.84) ─────────────────────────────────────────
  { key: "interactions", manual: "reports-interactions" },

  // ── Persons ─────────────────────────────────────────────────────────────
  { key: "natural-persons-list", manual: "persons-list" },
  { key: "natural-person-detail", manual: "persons-add" },
  { key: "judicial-persons-list", manual: "companies-list" },
  { key: "judicial-person-detail", manual: "companies-add" },

  // ── Association sub-pages ───────────────────────────────────────────────
  // Deliberately generic: the same five screens are reached from Property,
  // Document and both Person types, and the instructions are identical
  // regardless of which entity you arrived from. One key each, not one per
  // (entity x association) pair.
  { key: "associate-person", manual: "links-associate-screen" },
  { key: "associate-document", manual: "links-associate-screen" },
  { key: "associate-property", manual: "links-associate-screen" },
  { key: "associate-reference", manual: "links-references" },
  { key: "associate-party", manual: "documents-dependent-inheritance" },

  // ── Administration ──────────────────────────────────────────────────────
  { key: "admin-value-lists", manual: "admin-reference-data" },
  { key: "admin-import", manual: "import-overview" },
  // Slice #29.09. Registered rather than opted out: a screen that spends money
  // on twenty model reads and then writes a form every future document of a
  // type is read against is the opposite of self-evident.
  { key: "admin-doc-type-engine", manual: "tools-doc-type-engine" },
  { key: "admin-calculation", manual: "tools-side-road" },
  { key: "admin-calculation-history", manual: "tools-side-road-history" },
  { key: "admin-calculation-run", manual: "tools-side-road-history" },
  { key: "admin-groups", manual: "admin-groups-groups" },
  { key: "admin-group-editor", manual: "admin-groups-groups" },
  { key: "admin-stamps", manual: "admin-groups-stamps" },
  { key: "admin-stamp-applicator", manual: "admin-groups-stamps" },
  { key: "admin-tags", manual: "admin-groups-tags" },
  { key: "admin-settings", manual: "admin-settings" },
  { key: "admin-users", manual: "admin-users" },
  { key: "admin-global-search", manual: "reports-search" },
  { key: "admin-help-content", manual: "learning-help" },

  // ── Ajutor și învățare (Slice #39.37) ───────────────────────────────────
  { key: "manual", manual: "learning-manual" },
  // Slice #39.42: the skills diagram, and the page a skill's quiz opens on (#39.43 fills it).
  { key: "skills-map", manual: "learning-skills" },
  { key: "skill-quiz", manual: "learning-quizzes" },
  // Slice #39.45: „Întreabă”.
  { key: "ask", manual: "learning-ask" },
] as const satisfies readonly { key: string; manual: string }[];

export type HelpScreenKey = (typeof HELP_SCREENS)[number]["key"];

/**
 * The manual section a screen's „?” points at (Slice #39.40): its popover ends with „Vezi în manual: §5.2 …”, a
 * link to `manualHref(id)`. An id, never a number — the number is the manual's own, and renumbering a chapter
 * moves every link with it. `help-manual-links.test.ts` fails when an id resolves in either language's manual
 * to nothing.
 */
export function helpScreenManualSection(key: string): string | undefined {
  return HELP_SCREENS.find((s) => s.key === key)?.manual;
}

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

  // ── Tiles, on the four detail screens (Slice #37.23) ─────────────────────
  // Invisible state: the choice of tiles is kept in THIS browser, per screen
  // (per type on a Document), and another browser or computer shows the
  // default set. Its text is Adrian's; the #37.23 handover proposes it.
  {
    hintKey: "tile-selector",
    screens: ["natural-person-detail", "judicial-person-detail", "property-detail", "document-detail"],
  },

  // ── Calculation ─────────────────────────────────────────────────────────
  // Slice #39.79: „calc-file-format" left with the data file; its help rows stay in the database, unused.
  {
    hintKey: "calc-preview-not-saved",
    screens: ["admin-calculation"],
  },
  {
    hintKey: "calc-group-description-autofill",
    screens: ["admin-calculation"],
  },

  // ── List views: „select-all-page-only" went with the lists' tick boxes (Slice 40.10; Properties' in #39.73) ──
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
