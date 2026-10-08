/**
 * An act adițional and the deed it amends.                     (Slice #38.34)
 *
 * The link is the existing Document → Document relation „Act adițional la"
 * (`PURPOSE_ROLE_NAME.PARENT`, seeded by migration_085 and
 * sync-reference-data.sql), read FROM the act adițional TO its deed. The tile
 * „Actul modificat" shows that deed; while there is none it offers „Leagă actul
 * modificat" and shows the four free-text fields of the template group
 * „Actul modificat" — the fallback for a deed that is not in the archive.
 * Linking never clears them.
 *
 * An act adițional amends ONE deed (Ask first 3): a second link is refused by
 * the routes, with a sentence naming the one it has (`parentLinkConflict` in
 * queries.ts decides; this module only words it).
 *
 * PURE — no React, no DB. Imported by the routes, the tile and the tests.
 */
import { foldLookupName } from "@/lib/import/lookup-name-match";
import { PURPOSE_ROLE_NAME } from "./referenced-instruments";

/** Why a link „Act adițional la" may not be made (queries.ts → `parentLinkConflict`). */
export type ParentLinkConflict =
  | { reason: "several" }
  | { reason: "taken"; existing: { id: string; code: string; title: string | null } };

/** The `code` a refused link answers with; the screens turn it into their sentence. */
export const PARENT_TAKEN_CODE = "parent_taken";
export const PARENT_SEVERAL_CODE = "parent_several";

/** The 409 body for a refused link. `error` is for logs; screens read `code` and `existing`. */
export function parentConflictBody(conflict: ParentLinkConflict): {
  error: string;
  code: string;
  existing?: { id: string; code: string; title: string | null };
} {
  return conflict.reason === "several"
    ? { error: "An act adițional amends one deed; tick one.", code: PARENT_SEVERAL_CODE }
    : {
        error: "This act adițional already amends another deed; unlink it first.",
        code: PARENT_TAKEN_CODE,
        existing: conflict.existing,
      };
}

/** A link on the act adițional's screen, as `/api/documents/[id]/references` lists it. */
export interface ReferenceLike {
  id: string;
  relationshipRoleName: string | null;
  roleReadsFromViewed: boolean;
}

/** Whether a listed link is „this act is an addendum to X" — X being the deed it amends. */
export function isParentDeedLink(ref: ReferenceLike): boolean {
  return (
    ref.roleReadsFromViewed &&
    ref.relationshipRoleName !== null &&
    foldLookupName(ref.relationshipRoleName) === foldLookupName(PURPOSE_ROLE_NAME.PARENT)
  );
}

/** The deed the act adițional amends, or null — the first such link (the routes allow one). */
export function parentDeedOf<T extends ReferenceLike>(refs: readonly T[] | undefined): T | null {
  return (refs ?? []).find(isParentDeedLink) ?? null;
}

/** The deed types „Leagă actul modificat" lists first, in this order. */
export const PARENT_DEED_TYPES_FIRST: readonly string[] = ["CONTRACT_VANZARE"];

/** Search results with the contracts first, then the rest, each group in the order it came. */
export function orderDeedCandidates<T extends { id: string; typeKey: string | null }>(
  items: readonly T[],
  selfId: string,
): T[] {
  const others = items.filter((i) => i.id !== selfId);
  const rank = (i: T) => {
    const at = PARENT_DEED_TYPES_FIRST.indexOf(i.typeKey ?? "");
    return at < 0 ? PARENT_DEED_TYPES_FIRST.length : at;
  };
  return others
    .map((item, index) => ({ item, index }))
    .sort((a, b) => rank(a.item) - rank(b.item) || a.index - b.index)
    .map((x) => x.item);
}
