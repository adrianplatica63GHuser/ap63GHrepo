/**
 * A person-to-person role's family tie — what the inheritance tree reads.        (Slice #39.10)
 *
 * `lookup_person_role.kinship` (migration_106) says which family tie the HOLDER of the role has towards the other
 * person of a pair: „A Tată B" makes A the PARENT of B. It is read the way the role is — `role_reads_a_to_b` says
 * which end of the stored pair holds it (`roleHeldBy`, #37.28) — so from the other end the tie is its converse:
 * B is A's CHILD. NULL is „no family tie". OTHER is a relative who is none of the four („Nepot", „Bunic"): the tree
 * draws it, dashed, and places no generation by it.
 *
 * ⚠️ **A COLUMN, NEVER A ROLE'S NAME.** The names are Adrian's to rename on „Date de referință → Roluri Persoane";
 * the code reads this column, as it reads `parent_kind` for „Tată" and „Mamă" (#38.29). A role with a `parent_kind`
 * is always PARENT (CHECK chk_lookup_person_role_kinship_parent), so its tie is fixed in the role's panel.
 */
import { roleHeldBy } from "@/lib/persons/relation-roles";

export const KINSHIPS = ["PARENT", "CHILD", "SPOUSE", "SIBLING", "OTHER"] as const;
export type Kinship = (typeof KINSHIPS)[number];

export function isKinship(v: unknown): v is Kinship {
  return typeof v === "string" && (KINSHIPS as readonly string[]).includes(v);
}

/** The tie read from the other end: a parent's child is a child of the parent; the rest read the same both ways. */
export function converseKinship(k: Kinship): Kinship {
  if (k === "PARENT") return "CHILD";
  if (k === "CHILD") return "PARENT";
  return k;
}

/**
 * The tie `personId` has towards the other person of a stored pair, or null when the role names no family tie.
 * „A Tată B": A → PARENT, B → CHILD.
 */
export function tieOf(
  personId: string,
  pair: { personIdA: string; roleReadsAToB: boolean; kinship: string | null },
): Kinship | null {
  if (!isKinship(pair.kinship)) return null;
  return roleHeldBy(personId, pair.personIdA, pair.roleReadsAToB) ? pair.kinship : converseKinship(pair.kinship);
}

/**
 * migration_106's seed, as Adrian confirmed it on 2026-10-11 („yes, as listed") — set once, by name, on the roles
 * that existed; every other role stays NULL. Kept here so jest holds the migration and the reference seed to it.
 */
export const KINSHIP_SEED: Readonly<Record<string, Kinship>> = {
  Tată: "PARENT",
  Mamă: "PARENT",
  Părinte: "PARENT",
  Fiu: "CHILD",
  Fiică: "CHILD",
  Soț: "SPOUSE",
  Soție: "SPOUSE",
  Frate: "SIBLING",
  Soră: "SIBLING",
  Bunic: "OTHER",
  Nepot: "OTHER",
};
