/**
 * What a person-to-person relationship is called from each end.   (Slice #37.28)
 *
 * `person_person` stores a pair in uuid order and, since migration_088, says in
 * `role_reads_a_to_b` which of the two HOLDS the role: Ion recorded as „Fiu" of
 * Maria is held by Ion. A „Persoane" tile lists the OTHER person of each pair
 * beside a relationship word, and that word must be the listed person's:
 *
 *   - on Maria's tile Ion is listed, Ion holds „Fiu", so the word is „Fiu";
 *   - on Ion's tile Maria is listed, Maria holds the converse of „Fiu", so the
 *     word is „Părinte".
 *
 * The converse is DATA — `lookup_person_role.converse_name*`, edited on Date de
 * referință with the name — and gendered, because Romanian kinship is: the
 * converse of „Părinte" is „Fiu" for a man, „Fiică" for a woman and, with no
 * gender to go on (a company, or a person whose gender is not set), the neutral
 * „Copil". That neutral fallback is #37.28's answer to its „Ask first".
 *
 * ⚠️ **A ROLE WITH NO CONVERSE IS NOT GUESSED AT.** The same role word on both
 * ends is exactly the defect this slice removes, so a role Adrian adds later
 * without filling in its converse comes back as `held-by-viewed`, which the
 * screen renders as a sentence saying the person viewed holds the role. It can
 * be wordy; it cannot read backwards. A role that reads the same both ways says
 * so by naming ITSELF as its converse („Coproprietar").
 */

export type PersonGender = "MALE" | "FEMALE" | null;

/** The role and its converse, as `lookup_person_role` stores them. */
export type PersonRoleWords = {
  name:               string;
  converseName:       string | null;
  converseNameMale:   string | null;
  converseNameFemale: string | null;
};

/** What the „Tip relație" cell shows for one listed person. */
export type PersonRoleShown =
  | { kind: "none" }
  /** The word to show beside the listed person: their role, or its converse. */
  | { kind: "role"; name: string }
  /** The person VIEWED holds `name`, and the role names no converse. */
  | { kind: "held-by-viewed"; name: string };

function filled(value: string | null | undefined): string | null {
  const v = value?.trim();
  return v ? v : null;
}

/**
 * The converse of `role` for a person of `gender`: the gendered wording when
 * there is one for that gender, else the neutral one, else null.
 */
export function converseFor(role: PersonRoleWords, gender: PersonGender): string | null {
  const gendered =
    gender === "MALE"   ? filled(role.converseNameMale) :
    gender === "FEMALE" ? filled(role.converseNameFemale) :
    null;
  return gendered ?? filled(role.converseName);
}

/**
 * The word beside `listed` on the tile of the person viewed.
 *
 * @param role            the stored role, or null when the link has none
 * @param listedHoldsRole whether the LISTED person holds the stored role —
 *                        `!roleHeldBy(viewedId, idA, roleReadsAToB)`
 * @param listedGender    the listed person's gender; null for a company or unset
 */
export function personRoleShown(
  role: PersonRoleWords | null,
  listedHoldsRole: boolean,
  listedGender: PersonGender,
): PersonRoleShown {
  const name = filled(role?.name);
  if (!role || !name) return { kind: "none" };
  if (listedHoldsRole) return { kind: "role", name };
  const converse = converseFor(role, listedGender);
  return converse ? { kind: "role", name: converse } : { kind: "held-by-viewed", name };
}

/**
 * Whether `personId` holds the role on a stored pair — A when the flag is true,
 * B when it is false. Written out rather than as `(idA === personId) ===
 * roleReadsAToB`, the kind of line a later reader inverts by accident.
 */
export function roleHeldBy(personId: string, idA: string, roleReadsAToB: boolean): boolean {
  const isA = idA === personId;
  return isA ? roleReadsAToB : !roleReadsAToB;
}

/**
 * The stored pair for a link made on the „Asociază" screen of `viewedId`.
 *
 * That screen asks for the role of the person TICKED („Tip relație" of the one
 * you tick, towards the person whose screen it is) — which is how the tile has
 * always read it, the word sitting beside the listed person — so the ticked
 * person holds the role, and the flag is whether they landed on side A.
 */
export function pairForTicked(
  viewedId: string,
  tickedId: string,
): { personIdA: string; personIdB: string; roleReadsAToB: boolean } {
  const [personIdA, personIdB] = [viewedId, tickedId].sort();
  return { personIdA, personIdB, roleReadsAToB: tickedId === personIdA };
}
