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

/**
 * The document types whose saved records show „Părți": the contract de vânzare
 * (#38.33), the act adițional that amends one (#38.34), whose sellers and
 * buyers are the same people with the same shares, and — since #39.47 — the
 * certificat de moștenitor, whose heirs are its parties by the same rule; since
 * #39.57 every other type the rule fits, each with its reason below.
 *
 * ⚠️ **ONE RULE FOR ALL OF THEM (Slice #39.48).** Until then a certificate drew
 * its own „Părți" — a table of EVERY person on it, Defunct and notary too —
 * while „Legături" drew them all again with the heirs' „Cotă": every person in
 * two places, and the sale contract's rule read as the opposite. Now each of the
 * three lists its parties (a role that holds a share) in „Părți" only, and
 * „Legături" the rest, with one line saying where the parties are
 * (`document.parties.elsewhere`). A certificate's deceased holds no share, so
 * he stands on „Legături", as the sale contract's notary does.
 */
export const PARTIES_TILE_TYPES: readonly string[] = [
  "CONTRACT_VANZARE",
  "ACT_ADITIONAL",
  "CERTIFICAT_MOSTENITOR",
  // ── Slice #39.57, Adrian: „it should be done for all cases where it applies … and any other case where it fits!”
  // A type fits when its reference data gives at least one role that holds a share AND the act is made between those
  // parties or passes ownership to them. Each one below, and why:
  /** The promitent vânzător and the promitent cumpărător, each with a share; the notary on „Legături”. */
  "ANTECONTRACT",
  /** Donator and donatar: ownership passes from one to the other. */
  "ACT_DONATIE",
  /** The co-owners who divide the property between them („Coproprietar”, „Moștenitor”). */
  "CONTRACT_PARTAJ",
  "ACT_PARTAJ",
  /** The legatees („Legatar”) receive it; the testator holds no share and stays on „Legături”, as a deceased does. */
  "TESTAMENT",
  /** The adjudecatar receives it at auction; the debtor and the bailiff stay on „Legături”. */
  "ACT_ADJUDECARE",
  /**
   * The titlu de proprietate GIVES ownership — it is the deed that constitutes or reconstitutes it — to its owners,
   * heirs and co-owners, often several with their shares (66 „Proprietar” links on dev, 2026-10-15). Its issuing
   * authority holds no share and stays on „Legături”.
   */
  "TITLU_PROPRIETATE",
  // NOT here, and why: the extras de carte funciară, certificat de sarcini, act de cadastru, autorizație (and
  // autorizație de construire), certificat de urbanism, certificat fiscal, certificat de bunuri, aviz, plan de
  // amplasament, act de dezmembrare / alipire and încheiere de intabulare only REPORT the owner of record: a
  // „Părți” of one owner with no counterpart adds a tile and tells nothing new. The hotărâre judecătorească's
  // parties are the claimant and the defendant, whose roles hold no share.
];

export function hasPartiesTile(typeKey: string | null | undefined): boolean {
  return !!typeKey && PARTIES_TILE_TYPES.includes(typeKey);
}

/**
 * Where „Părți"'s „Asociază persoană" goes. A certificate keeps the screen it
 * always had, „Adaugă parte la certificat" (one person at a time, the
 * certificate's roles); the others the association screen every document uses.
 */
export function partiesAssociatePath(typeKey: string | null | undefined, documentId: string): string {
  const id = encodeURIComponent(documentId);
  return typeKey === "CERTIFICAT_MOSTENITOR" ? `/documents/${id}/associate-party` : `/documents/${id}/associate-person`;
}

/** A party: its role holds a share on this document's type. */
export function isPartyLink(link: { holdsShare: boolean }): boolean {
  return link.holdsShare;
}

/**
 * Roles whose group comes first, in this order; the order only, never membership. The one who gives before the one
 * who receives, as a deed names them (#39.57: the promitenți, the donor before the donee).
 */
export const PARTY_ROLES_FIRST: readonly string[] = ["Vânzător", "Cumpărător", "Promitent vânzător", "Promitent cumpărător", "Donator", "Donatar"];

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
