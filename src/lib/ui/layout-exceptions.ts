/**
 * Where the fixed-width rule does not apply, and why.            (Slice #37.23)
 *
 * #37.12–#37.22 put every screen on one rule: THE WINDOW DECIDES HOW MANY
 * PANELS FIT, NEVER HOW WIDE ANYTHING IS. `src/__tests__/layout-guard.test.ts`
 * keeps it from coming undone. It fails when a component under `src/app` wraps
 * what it shows in a centring max-width (`mx-auto` with a `max-w-…`), or when a
 * form box under `src/app` or `src/components` takes a stretching width
 * (`w-full`, `flex-1`, `min-w-[…]`, `max-w-…`) instead of one from
 * `src/lib/ui/field-widths.ts`.
 *
 * These are the places that rule does not reach. Each has its reason, as
 * `CATALOGUE_OPTED_OUT`'s entries do, and the guard fails an entry without one.
 * An entry is:
 *   - a `file` (or a folder, ending in `/`), repo-relative; optionally
 *   - a `region` inside it, from its first marker to the next occurrence of
 *     its second (or to the end of the file when the second is ""); or
 *   - a `line` pattern: any line containing it, in any file.
 *
 * ⚠️ **AN ENTRY IS A DECISION, NOT A WAY TO SILENCE THE GUARD.** A screen the
 * rule should reach is fixed, or filed in the follow-up register; it is not
 * added here.
 */
export interface LayoutException {
  /** A repo-relative file, or a folder ending in `/`. */
  file?: string;
  /** A part of `file`: from the first marker to the second ("" = the end of the file). */
  region?: readonly [string, string];
  /** Any line containing this, anywhere. */
  line?: string;
  /** One sentence: why the rule does not apply here. */
  reason: string;
}

export const LAYOUT_EXCEPTIONS: readonly LayoutException[] = [
  {
    line: "data-tile-centred",
    reason:
      "A Reference Data tile (#39.75) is whole units and its list a little narrower; the list centred in the tile is what gives it the same gap to the tile's left and right edges (Adrian, 2026-10-17) — since #39.88 the list fills it at the standard gap, and the centring is what keeps the roles' and the links' lists, which keep their own width, even. The column is the tile, which is not capped — `max-w-full` only keeps the list inside it.",
  },
  {
    line: "data-tag-input",
    reason:
      "Etichete și grupuri's tag box (41.27) takes what is left of its row beside „Adaugă”, never narrower than M (TAG_BOX_STYLE's minWidth), so the tile fits 2 units and the box grows on 3 — Adrian asked for the tile at 2 units, and a fixed XL box (272 px) is wider than 2 units' 228 inside.",
  },
  {
    line: "data-groups-picker",
    reason:
      "Etichete și grupuri's group picker (41.39) takes what is left of its row, as the tag box does: a native select is as wide as its longest option, and a group's description of up to 500 characters spilled past the tile and refused every narrower width — so the options are cut to about 60 characters and the box never sets the tile's width.",
  },
  {
    line: "data-stamps-picker",
    reason:
      "Etichete și grupuri's stamp picker (41.39) takes what is left of its row, for the same reason as the group picker: its options' descriptions are cut, and the box never widens the tile.",
  },
  {
    line: "fixed inset-",
    reason:
      "A dialog's card is fixed by design: its max-w-sm, -md or -lg — or, since #37.37, the value lists' editors' whole width units (`dialogCardStyle`) — holds it at one width over the page, and centring it over the page is what makes it a dialog.",
  },
  {
    file: "src/app/properties/map/",
    reason: "The property map fills the window on purpose: it is the one screen whose content is the window itself.",
  },
  {
    file: "src/app/login/",
    reason: "The login card is centred in an empty window before anyone is signed in; there is no sidebar to sit beside.",
  },
  {
    file: "src/app/signup/",
    reason: "The request-access card is centred in an empty window, like the login card, for the same reason.",
  },
  {
    file: "src/app/admin/import/",
    reason: "The import wizard has its own rule file and its own risks; FU-269 says what putting it on the rule would take.",
  },
  {
    file: "src/app/documents/_components/pages-panel.tsx",
    region: ["function PageViewer(", "function DownloadPrompt("],
    reason: "The full-screen page viewer shows one page image as large as the window allows, which is its purpose.",
  },
  {
    file: "src/app/documents/_components/pages-panel.tsx",
    region: ["function AddPageDialog(", "function DeleteConfirmDialog("],
    reason: "„Adaugă pagină” is a dialog: its boxes fill its fixed card.",
  },
  {
    file: "src/app/admin/tags/_components/tag-manager.tsx",
    region: ["function MergeModal(", "export function TagManager("],
    reason: "Merging tags happens in a dialog: its boxes fill its fixed card; since #38.14 a tag is renamed in its chip, on the rule.",
  },
  {
    file: "src/components/sidebar/sidebar-nav.tsx",
    region: ["onSubmit={handleQuickSearch}", "</form>"],
    reason: "The sidebar's quick search fills the sidebar, whose own width is fixed and never follows the window.",
  },
];
