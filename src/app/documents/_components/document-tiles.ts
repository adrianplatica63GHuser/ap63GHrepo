/**
 * The Document's tiles.                                        (Slice #37.20)
 *
 * #37.17 built the tiles; this file only declares them. The tab row (Detalii,
 * Asocieri, Persoane, Proprietăți, META INFO) gives way to:
 *
 *   Date generale · Pagini · one tile per notebook tab of the type (or, for a
 *   type with none, one tile for its own fields) · Părți (a Certificat de
 *   Moștenitor only) · Persoane · Proprietăți · Asocieri · META INFO
 *
 * Unlike the other three screens, the SET OF TILES DEPENDS ON THE TYPE. A
 * Contract de vânzare-cumpărare has Instrument, Cadastru, Stare juridică and
 * Conformitate; a Plan parcelar has its own fields. So the registry is BUILT
 * from the type on screen (`documentTileRegistry`), and it is REMEMBERED PER
 * TYPE: the storage key carries the type's key, because a CVC and a Plan
 * parcelar want different screens. Changing the type on screen switches to
 * that type's stored choice; the form stays mounted, so unsaved values stay.
 *
 * THE NOTEBOOK'S GUARANTEES CARRY OVER. Which tile a panel lives on is decided
 * by `templateTabsOf` / `tabIndexOfPanel` / the fees-pair rules in
 * `@/lib/documents/template-tabs`, exactly as they decide which notebook tab it
 * lives on — this file adds no rule of its own.
 *
 * Nothing stored shows what Detalii showed: the general data, the first
 * notebook tab (or the type's own fields), the page image, and — on a
 * Certificat de Moștenitor — the parties.
 *
 * PURE — no React. Imported by the page and by tests alike.
 */
import type { TileRegistry } from "@/lib/ui/tiles";

/** What the form knows and the tile row needs: the type on screen. */
export interface DocumentLayout {
  /** The type's stable key (`CONTRACT_VANZARE`), or null while none is chosen or the types are loading. */
  typeKey: string | null;
  /** `templateTabsOf(fields)` — `[]` for a type with no notebook. */
  tabs: readonly string[];
  /** A Certificat de Moștenitor: the parties panel is offered as a tile. */
  succession: boolean;
  /** A saved document: the page image is offered as a tile. */
  pages: boolean;
  /**
   * The types have loaded, so `typeKey` is the type's and not a placeholder.
   *
   * ⚠️ **NO TICK BEFORE THIS.** Measured in full 20260929T004229Z-10537
   * (TC-ASSOC-01): a box ticked while the types were still loading was stored
   * under the placeholder's key; then the type arrived, the registry and its
   * key changed, the choice was read again from the type's own key — nothing
   * there — and the tick was gone. The page draws the checkboxes only once this
   * is true. Absent means true (a layout built by hand, as the tests do).
   */
  ready?: boolean;
}

/** The tile of notebook tab `label`. The label is the key: exact text, as `templateTabsOf` keeps it. */
export function tabTileKey(label: string): string {
  return `tab:${label}`;
}

/**
 * Tabs renamed since a choice could have been stored under them, old label →
 * new (Slice #37.54: the CVC's „Instrument", „Cadastru" and „Conformitate").
 * A tile's key IS its tab's label, so without this a renamed tab would drop
 * every browser's remembered choice of that tile. The registry passes it on
 * as `renamed`, for the tabs the type on screen still has.
 */
export const RENAMED_TABS: Readonly<Record<string, string>> = {
  Instrument: "Preț și taxe",
  Cadastru: "Cadastru și carte funciară",
  Conformitate: "Formalități",
};

/** The single tile of a type with no notebook tabs. */
export const FIELDS_TILE = "fields";

/** The tile of notebook page `index` — or the fields tile when there is no notebook. */
export function tileOfTabIndex(tabs: readonly string[], index: number): string {
  return tabs.length > 0 ? tabTileKey(tabs[Math.min(Math.max(index, 0), tabs.length - 1)]) : FIELDS_TILE;
}

export const DOCUMENT_LIST_TILES = ["persons", "properties", "associations", "metadata"] as const;

/** Built from the type on screen. The entity — and so the storage key — carries the type's key. */
export function documentTileRegistry(layout: DocumentLayout): TileRegistry<string> {
  const typeTiles = layout.tabs.length > 0 ? layout.tabs.map(tabTileKey) : [FIELDS_TILE];
  const all = [
    "general",
    ...(layout.pages ? ["pages"] : []),
    ...typeTiles,
    ...(layout.succession ? ["succession"] : []),
    ...DOCUMENT_LIST_TILES,
  ];
  return {
    entity: `document-${layout.typeKey ?? "untyped"}`,
    all,
    defaults: [
      "general",
      ...(layout.pages ? ["pages"] : []),
      typeTiles[0],
      ...(layout.succession ? ["succession"] : []),
    ],
    // Hidden, never unmounted: the form's panels, and the page image and the
    // parties panel, which hold state of their own (an upload, a party row).
    form: [
      "general",
      ...(layout.pages ? ["pages"] : []),
      ...typeTiles,
      ...(layout.succession ? ["succession"] : []),
    ],
    // Slice #37.56: the page image stands at the right of the row, top-aligned.
    placement: { right: layout.pages ? ["pages"] : [] },
    renamed: Object.fromEntries(
      Object.entries(RENAMED_TABS)
        .filter(([, now]) => layout.tabs.includes(now))
        .map(([was, now]) => [tabTileKey(was), tabTileKey(now)]),
    ),
  };
}

/**
 * `?tab=` still works: the tab it named adds its tile for this visit and
 * scrolls to it. The association screens' „Înapoi" links carry these values.
 */
export const DOC_TILE_OF_TAB: Readonly<Record<string, string | undefined>> = {
  related: "associations",
  persons: "persons",
  properties: "properties",
  metadata: "metadata",
};

/**
 * HIGHLIGHTS ARE NOT LOST IN A HIDDEN TILE.
 *
 * The tiles whose checkbox is marked: those holding a highlighted field that
 * are not on screen. `highlighted` is the tile of every field the form frames
 * (a version-diff frame, a pulse), in any order and with repeats; `shown` is
 * what is on screen. The result is in registry order, each tile once, and
 * never names a tile the registry does not have.
 */
export function markedTiles(
  highlighted: readonly string[],
  shown: readonly string[],
  all: readonly string[],
): string[] {
  const hidden = new Set(highlighted.filter((k) => !shown.includes(k)));
  return all.filter((k) => hidden.has(k));
}
