/**
 * The Document's tiles.                                        (Slice #37.20)
 *
 * #37.17 built the tiles; this file only declares them. The tab row (Detalii,
 * Asocieri, Persoane, Proprietăți, META INFO) gives way to:
 *
 *   Date generale · Pagini · one tile per notebook tab of the type (or, for a
 *   type with none, one tile for its own fields) · Părți (a Certificat de
 *   Moștenitor only) · Corelate (#37.65: Persoane, Proprietăți and Asocieri in
 *   one) · Clasificări · Conexiuni (#37.63: META INFO in two)
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
  /**
   * Slice #38.32: the type has fields of its own, so „Detalii act" (or its
   * notebook tiles) has something to hold. Until #38.32 the fields tile always
   * held at least the issuer, number and date; since they moved to
   * „Identificarea actului", a type with no fields of its own (a Certificat de
   * moștenitor, a document with no type yet) would draw an empty tile, so it is
   * not offered. Absent means true (a layout built by hand, as the tests do).
   */
  ownFields?: boolean;
  /** A saved document: the page image is offered as a tile. */
  pages: boolean;
  /**
   * Slice #38.33: a saved contract de vânzare — „Părți", its sellers and buyers
   * with their shares (`@/lib/documents/sale-parties`), is offered as a tile.
   * Absent means false.
   */
  parties?: boolean;
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
 *
 * Each old label maps straight to today's — `parseStoredTiles` follows one
 * step, not a chain — so #37.90's „Cadastru și CF" is the target of both
 * „Cadastru" and „Cadastru și carte funciară".
 */
// Slice #38.33: the CVC's four tiles became five type tiles, so an old tile now
// stands for ONE OR MORE new ones — a browser that showed „Preț și taxe" shows
// „Preț și plată" and „Taxe și cheltuieli". Every old name maps straight to
// today's tiles (no chain through #37.54's names), because a stored choice is
// read once, through this map alone.
export const RENAMED_TABS: Readonly<Record<string, string | readonly string[]>> = {
  Instrument: ["Preț și plată", "Taxe și cheltuieli"],
  "Preț și taxe": ["Preț și plată", "Taxe și cheltuieli"],
  Cadastru: ["Carte funciară", "Obiectul vânzării"],
  "Cadastru și carte funciară": ["Carte funciară", "Obiectul vânzării"],
  "Cadastru și CF": ["Carte funciară", "Obiectul vânzării"],
  "Stare juridică": "Declarații și garanții",
  Conformitate: ["Declarații și garanții", "Taxe și cheltuieli"],
  Formalități: ["Declarații și garanții", "Taxe și cheltuieli"],
};

/** The tile keys an old tab's tile stands for, among the tabs the type has — none, one or several. */
export function renamedTabTiles(was: string, tabs: readonly string[]): string[] {
  const now = RENAMED_TABS[was];
  if (now === undefined) return [];
  return (typeof now === "string" ? [now] : [...now]).filter((t) => tabs.includes(t)).map(tabTileKey);
}

/** The single tile of a type with no notebook tabs. */
export const FIELDS_TILE = "fields";

/** Slice #38.33: a contract de vânzare's sellers and buyers (`layout.parties`). */
export const PARTIES_TILE = "parties";

/** The tile of notebook page `index` — or the fields tile when there is no notebook. */
export function tileOfTabIndex(tabs: readonly string[], index: number): string {
  return tabs.length > 0 ? tabTileKey(tabs[Math.min(Math.max(index, 0), tabs.length - 1)]) : FIELDS_TILE;
}

// Slice #37.63: META INFO („metadata") is two tiles — „Clasificări" and „Conexiuni".
// Slice #37.65: Persoane, Proprietăți and „Acte corelate" are one tile, „Corelate" („related").
export const DOCUMENT_LIST_TILES = ["related", "classification", "connections"] as const;

/**
 * The three tiles „Corelate" replaced (#37.65). A browser that had any of them
 * ticked opens with „Corelate" ticked — under every type's key, since the
 * registry passes this on whatever the type.
 */
export const RELATED_WAS: Readonly<Record<string, "related">> = {
  persons: "related",
  properties: "related",
  associations: "related",
};

/** Built from the type on screen. The entity — and so the storage key — carries the type's key. */
export function documentTileRegistry(layout: DocumentLayout): TileRegistry<string> {
  const typeTiles = layout.tabs.length > 0 ? layout.tabs.map(tabTileKey) : layout.ownFields === false ? [] : [FIELDS_TILE];
  // Slice #37.88: in the groups' order — the record's own data (with „Părți"),
  // „Corelate", „Clasificări" and „Conexiuni", then „Pagini" at the right.
  // Slice #38.33: a contract de vânzare's „Părți" stands after its type tiles, as a certificate's does.
  const parties = layout.parties ? [PARTIES_TILE] : [];
  const record = ["general", ...typeTiles, ...parties, ...(layout.succession ? ["succession"] : [])];
  const fixed = layout.pages ? ["pages"] : [];
  const all = [...record, ...DOCUMENT_LIST_TILES, ...fixed];
  return {
    entity: `document-${layout.typeKey ?? "untyped"}`,
    all,
    defaults: [
      "general",
      ...(layout.pages ? ["pages"] : []),
      ...typeTiles.slice(0, 1),
      ...parties,
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
    placement: { right: fixed },
    groups: { record, related: ["related"], meta: ["classification", "connections"], fixed },
    renamed: {
      ...Object.fromEntries(
        Object.keys(RENAMED_TABS)
          .map((was) => [was, renamedTabTiles(was, layout.tabs)] as const)
          .filter(([, now]) => now.length > 0)
          .map(([was, now]) => [tabTileKey(was), now.length === 1 ? now[0] : now]),
      ),
      // A browser that stored META INFO opens with both of its halves (#37.63).
      metadata: ["classification", "connections"],
      // …and one that stored any of the three lists, with „Corelate" (#37.65).
      ...RELATED_WAS,
    },
  };
}

/**
 * `?tab=` still works: the tab it named adds its tile for this visit and
 * scrolls to it. The association screens' „Înapoi" links carry these values.
 */
// Slice #37.63: META INFO is two tiles — „Clasificări" and „Conexiuni".
// A browser that stored „metadata" opens with both ticked; `?tab=metadata` adds both.
// Slice #37.65: the association screens' „Înapoi" (?tab=persons, properties, related) all land on „Corelate".
export const DOC_TILE_OF_TAB: Readonly<Record<string, string | readonly string[] | undefined>> = {
  related: "related",
  persons: "related",
  properties: "related",
  metadata: ["classification", "connections"],
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
