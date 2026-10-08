/**
 * A user's own default tiles, and how a screen reads them.        (Slice #38.41)
 *
 * „Contul meu" saves, per kind of record, the tiles „Implicit" returns to
 * (`user_tile_default`, migration_101). This module is the pure half: which
 * kind a screen's registry belongs to, and what a saved set means for that
 * registry today.
 *
 * ⚠️ **A SAVED SET IS READ, NEVER TRUSTED.** It names tiles as they were on
 * the day it was saved. A tile renamed since is read through the registry's
 * `renamed` map, exactly as a browser's stored choice is (`parseStoredTiles`);
 * a tile removed since is dropped; and a set that comes out empty is no set —
 * the registry's own `defaults` stand.
 *
 * DOCUMENTS. A document's registry is built per type: its form tiles are the
 * type's notebook pages, which no other type shares. So the document row in
 * „Contul meu" offers the tiles every type has, plus „fields" — „the type's
 * own tiles" — which reads, on a given type, as whatever the type ticks by
 * default among its own (the first notebook page, „Părți", „Părți" of a
 * certificate). That is the one thing a user can mean by it across forty
 * types.
 */

import { type TileRegistry, inRegistryOrder } from "./tiles";

export const TILE_DEFAULT_KINDS = ["natural-person", "judicial-person", "property", "document"] as const;
export type TileDefaultKind = (typeof TILE_DEFAULT_KINDS)[number];

export function isTileDefaultKind(x: string): x is TileDefaultKind {
  return (TILE_DEFAULT_KINDS as readonly string[]).includes(x);
}

/** The kind a registry's entity belongs to: `document-<TYPE>` is a document; the dashboard is none. */
export function kindOfEntity(entity: string): TileDefaultKind | null {
  if (entity.startsWith("document-")) return "document";
  return isTileDefaultKind(entity) ? entity : null;
}

/** The tiles every document type has — what the document row in „Contul meu" can tick. */
export const DOCUMENT_COMMON_TILES = ["general", "fields", "related", "classification", "connections", "pages"] as const;

/** What „Implicit" shows on most document types, in the document row's words: the act, its own tiles, the pages. */
export const DOCUMENT_BUILT_IN_DEFAULTS = ["general", "fields", "pages"] as const;

/** A document type's own tiles — what „fields" stands for on it. */
const DOCUMENT_COMMON_NOT_OWN = new Set<string>(["general", "related", "classification", "connections", "pages"]);

/**
 * What a saved set means on this registry: the tiles to show, in registry
 * order — or null when there is no usable set and `defaults` stand.
 */
export function savedDefaultsFor<K extends string>(reg: TileRegistry<K>, saved: unknown): K[] | null {
  if (!Array.isArray(saved)) return null;
  const keys = saved
    .filter((x): x is string => typeof x === "string")
    .flatMap((k) => {
      const renamed = reg.renamed?.[k];
      if (renamed !== undefined) return typeof renamed === "string" ? [renamed] : [...renamed];
      return [k];
    })
    .flatMap((k) =>
      // „fields" on a document: the type's own tiles, as the type ticks them.
      k === "fields" && kindOfEntity(reg.entity) === "document" && !reg.all.includes("fields" as K)
        ? reg.defaults.filter((d) => !DOCUMENT_COMMON_NOT_OWN.has(d))
        : [k],
    );
  const known = inRegistryOrder(keys, reg.all);
  return known.length > 0 ? known : null;
}

/** The set „Implicit" returns to: the user's own, or the registry's. */
export function effectiveDefaults<K extends string>(reg: TileRegistry<K>, saved: unknown): K[] {
  return savedDefaultsFor(reg, saved) ?? [...reg.defaults];
}
