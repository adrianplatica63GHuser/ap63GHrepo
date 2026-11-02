/**
 * Where a „Vezi și" reference opens, and where a record's group or stamp opens.                   (Slice 41.45)
 *
 * A reference's peer is a principal object — PERSON, PROPERTY or DOCUMENT — and a person is a natural or a juridical
 * one, which only `person.type` says (cross-ref.ts reads it as `peerPersonKind`). Until 41.45 every person went to
 * /persons/{id}, a route that does not exist; now each goes to its own screen. A person whose kind did not come back
 * goes to the natural persons' screen, which is what most of the archive's people are.
 *
 * PURE — peer-href.test.ts.
 */
export type PersonKind = "NATURAL" | "JUDICIAL";

export function peerHref(peerType: string, peerEntityId: string, personKind?: PersonKind | null): string {
  const id = encodeURIComponent(peerEntityId);
  if (peerType === "PROPERTY") return `/properties/${id}`;
  if (peerType === "DOCUMENT") return `/documents/${id}`;
  return personKind === "JUDICIAL" ? `/judicial-persons/${id}` : `/natural-persons/${id}`;
}

/**
 * 41.45 — a group or a stamp opened from a record shows only its identity tile, for that visit (`?tiles=`, read by
 * `useAdminTiles`); opened from the lists, it shows its stored choice. `back` is the record's `withBack`, which starts
 * the query string.
 */
export const GROUP_FROM_RECORD_TILES = "identity";
export const STAMP_FROM_RECORD_TILES = "description";

export function groupFromRecordHref(groupId: string, back: (href: string) => string): string {
  return `${back(`/admin/groups/${encodeURIComponent(groupId)}`)}&tiles=${GROUP_FROM_RECORD_TILES}`;
}

export function stampFromRecordHref(stampId: string, back: (href: string) => string): string {
  return `${back(`/admin/stamps/${encodeURIComponent(stampId)}`)}&tiles=${STAMP_FROM_RECORD_TILES}`;
}
