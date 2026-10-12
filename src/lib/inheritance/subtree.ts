/**
 * One person's tree — who the tile on their screen draws.                             (Slice #39.12)
 *
 * Adrian: „a tile with a limited inheritance tree for only 1 person … the current person and all the other persons
 * related with family relations to this Person going back in time and forward, so we expect to find great
 * grandparents all the way to siblings and children of this person". So (#39.12's Ask first 3): the person; their
 * ancestors up to great-grandparents; their descendants down to great-grandchildren; their siblings — a tie that
 * says so, or a parent in common; and the spouse of every one of those, so a couple is drawn as a couple. An
 * „other relative" tie of the person themself is in too. Nobody else: a cousin, an uncle or a sibling's child is
 * in the whole tree (#39.11), not here.
 */
import { edgeOf, type TreeEdge, type TreePerson, type TreeTie } from "@/lib/inheritance/layout";

export const GENERATIONS_UP = 3;
export const GENERATIONS_DOWN = 3;

export function personSubtree(
  personId: string,
  persons: readonly TreePerson[],
  ties: readonly TreeTie[],
): { persons: TreePerson[]; ties: TreeTie[] } {
  const edges = ties.map((t) => [t, edgeOf(t)] as const).filter((x): x is readonly [TreeTie, TreeEdge] => x[1] !== null);
  const parentsOf = (id: string) => edges.flatMap(([, e]) => (e.kind === "parent" && e.child === id ? [e.parent] : []));
  const childrenOf = (id: string) => edges.flatMap(([, e]) => (e.kind === "parent" && e.parent === id ? [e.child] : []));
  const sideways = (id: string, kind: "spouse" | "sibling" | "other") =>
    edges.flatMap(([, e]) => (e.kind === kind && (e.a === id || e.b === id) ? [e.a === id ? e.b : e.a] : []));

  const keep = new Set<string>([personId]);
  const walk = (start: string, next: (id: string) => string[], depth: number) => {
    let frontier = [start];
    for (let d = 0; d < depth; d++) {
      frontier = frontier.flatMap(next).filter((id) => !keep.has(id));
      for (const id of frontier) keep.add(id);
    }
  };
  walk(personId, parentsOf, GENERATIONS_UP);
  walk(personId, childrenOf, GENERATIONS_DOWN);
  const siblings = new Set([...sideways(personId, "sibling"), ...parentsOf(personId).flatMap(childrenOf)]);
  siblings.delete(personId);
  for (const id of siblings) keep.add(id);
  for (const id of sideways(personId, "other")) keep.add(id);
  for (const id of [...keep]) for (const s of sideways(id, "spouse")) keep.add(s);

  const known = new Set(persons.map((p) => p.id));
  return {
    persons: persons.filter((p) => keep.has(p.id)),
    ties: ties.filter((t) => keep.has(t.personIdA) && keep.has(t.personIdB) && known.has(t.personIdA) && known.has(t.personIdB)),
  };
}

/** The roles C offers: a person-to-person role that names a family tie (#39.10), by name. */
export function familyRoles<R extends { name: string; validForPerson?: boolean | null; kinship?: string | null }>(roles: readonly R[]): R[] {
  return roles.filter((r) => r.validForPerson === true && typeof r.kinship === "string" && r.kinship !== "")
    .sort((a, b) => a.name.localeCompare(b.name, "ro"));
}
