/**
 * Who the parties of a sale are, and where they are shown.     (Slice #38.33)
 *
 * A contract de vânzare's „Părți" tile lists its sellers and buyers with their
 * shares, the way a Certificat de moștenitor lists its heirs. The tile reads
 * the same person_document rows as „Legături" — no new storage.
 *
 * ⚠️ **A PARTY IS A LINK WHOSE ROLE HOLDS A SHARE ON THE DOCUMENT'S TYPE**
 * (`lookup_doc_type_person_role.holds_share`, migration_091) — data an
 * administrator keeps in Date de referință, never a list of names here. On a
 * contract de vânzare that is, on 2026-10-07: „Cumpărător", „Moștenitor /
 * Succesor", „Vânzător". Every other link (the notary, a mandatar, a creditor)
 * stays on „Legături", so each link has one home (Ask first 1).
 *
 * The tile groups the parties by role. `PARTY_ROLES_FIRST` decides only the
 * ORDER of those groups — sellers before buyers, as a deed names them — and a
 * renamed role falls back to alphabetical order; it never decides who is a
 * party.
 *
 * PURE — no React, no DB.
 */

/** The document types whose saved records show „Părți" (38.34 adds the act adițional). */
export const PARTIES_TILE_TYPES: readonly string[] = ["CONTRACT_VANZARE"];

export function hasPartiesTile(typeKey: string | null | undefined): boolean {
  return !!typeKey && PARTIES_TILE_TYPES.includes(typeKey);
}

/** A party: its role holds a share on this document's type. */
export function isPartyLink(link: { holdsShare: boolean }): boolean {
  return link.holdsShare;
}

/** Roles whose group comes first, in this order; the order only, never membership. */
export const PARTY_ROLES_FIRST: readonly string[] = ["Vânzător", "Cumpărător"];

/** The role groups, in display order: `PARTY_ROLES_FIRST`, then the rest alphabetically (Romanian), then no role. */
export function partyGroupOrder(roleNames: readonly (string | null)[]): (string | null)[] {
  const unique = [...new Set(roleNames)];
  const rank = (r: string | null) => {
    if (r === null) return [2, ""] as const;
    const i = PARTY_ROLES_FIRST.indexOf(r);
    return i >= 0 ? ([0, String(i).padStart(3, "0")] as const) : ([1, r] as const);
  };
  return unique.sort((a, b) => {
    const [ka, va] = rank(a);
    const [kb, vb] = rank(b);
    return ka !== kb ? ka - kb : va.localeCompare(vb, "ro");
  });
}
