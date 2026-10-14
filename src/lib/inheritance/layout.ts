/**
 * The inheritance tree's layout — pure.                                             (Slice #39.11)
 *
 * „Rapoarte → Arbori de moștenire" draws every natural person who has a family tie: persons are nodes, ties are
 * lines, generations run top to bottom. A tie is a `person_person` pair whose role carries a kinship (#39.10,
 * migration_106), read the way the role is (`tieOf`): „A Tată B" makes A the parent of B. A person with no family
 * tie is not drawn; a company never is (it has no family).
 *
 * THE RULES, as the genealogy tools draw a descendancy chart (FamilySearch's and Gramps' „fan down"):
 *   - a parent is one generation above the child; spouses and siblings share a generation; OTHER („Nepot",
 *     „Bunic") places nothing — it is drawn dashed between two people placed by their other ties;
 *   - in a generation, a child stands under its parents (the mean of their places), siblings in birth order,
 *     a spouse right beside their partner;
 *   - each separate family is its own cluster, the largest first, side by side.
 * Contradictory data (a person their own grandparent) is not refused: the first placement wins and the tie is
 * still drawn.
 */
import { converseKinship, isKinship, type Kinship } from "@/lib/persons/kinship";
import type { PersonGender, PersonRoleWords } from "@/lib/persons/relation-roles";

export type TreePerson = {
  id: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  nickname: string | null;
  gender: PersonGender;
  /** ISO yyyy-mm-dd, or null. */
  dateOfBirth: string | null;
  /** Slice #39.30: „Decedat", and the date of death (ISO, or null — dead with the date unknown). */
  isDeceased?: boolean;
  dateOfDeath?: string | null;
};

/** One stored pair whose role names a family tie. */
export type TreeTie = {
  id: string;
  personIdA: string;
  personIdB: string;
  roleReadsAToB: boolean;
  kinship: string;
  role: PersonRoleWords;
};

/** A tie as drawn: a parent above a child, or two people side by side. */
export type TreeEdge =
  | { kind: "parent"; tieId: string; parent: string; child: string }
  | { kind: "spouse" | "sibling" | "other"; tieId: string; a: string; b: string };

export type LaidNode = { id: string; x: number; y: number; generation: number; cluster: number };

export type TreeLayout = {
  nodes: LaidNode[];
  edges: TreeEdge[];
  /** Each family, largest first: its persons and its horizontal extent. */
  clusters: { index: number; size: number; left: number; right: number }[];
  width: number;
  height: number;
};

export const SLOT_W = 200;
export const ROW_H = 150;
export const CLUSTER_GAP = 160;

/** The holder's tie decides the line: PARENT → the holder above, CHILD → the other above, the rest side by side. */
export function edgeOf(tie: TreeTie): TreeEdge | null {
  if (!isKinship(tie.kinship) || tie.personIdA === tie.personIdB) return null;
  const holder = tie.roleReadsAToB ? tie.personIdA : tie.personIdB;
  const other = holder === tie.personIdA ? tie.personIdB : tie.personIdA;
  const k: Kinship = tie.kinship;
  if (k === "PARENT") return { kind: "parent", tieId: tie.id, parent: holder, child: other };
  if (k === "CHILD") return { kind: "parent", tieId: tie.id, parent: other, child: holder };
  return { kind: k === "SPOUSE" ? "spouse" : k === "SIBLING" ? "sibling" : "other", tieId: tie.id, a: holder, b: other };
}

/** The tie `personId` has towards `otherId` along one edge. */
export function tieAlong(edge: TreeEdge, personId: string): Kinship {
  if (edge.kind === "parent") return edge.parent === personId ? "PARENT" : converseKinship("PARENT");
  return edge.kind === "spouse" ? "SPOUSE" : edge.kind === "sibling" ? "SIBLING" : "OTHER";
}

const ends = (e: TreeEdge): [string, string] => (e.kind === "parent" ? [e.parent, e.child] : [e.a, e.b]);

/** Older first; no date after every date; then the name — a stable order for siblings and for the top row. */
export function byBirth(a: TreePerson, b: TreePerson): number {
  const da = a.dateOfBirth ?? "9999";
  const db = b.dateOfBirth ?? "9999";
  if (da !== db) return da < db ? -1 : 1;
  return a.displayName.localeCompare(b.displayName, "ro");
}

export function layoutTree(persons: readonly TreePerson[], ties: readonly TreeTie[]): TreeLayout {
  const byId = new Map(persons.map((p) => [p.id, p]));
  const edges = ties
    .map(edgeOf)
    .filter((e): e is TreeEdge => e !== null && ends(e).every((id) => byId.has(id)));
  // Only who has a tie is drawn.
  const drawn = new Set(edges.flatMap(ends));
  const adj = new Map<string, TreeEdge[]>();
  for (const id of drawn) adj.set(id, []);
  for (const e of edges) for (const id of ends(e)) adj.get(id)!.push(e);

  // ── Families: the connected groups, over every tie ──────────────────────────
  const families: string[][] = [];
  const seen = new Set<string>();
  const ordered = [...drawn].map((id) => byId.get(id)!).sort(byBirth);
  for (const start of ordered) {
    if (seen.has(start.id)) continue;
    const group: string[] = [];
    const stack = [start.id];
    seen.add(start.id);
    while (stack.length) {
      const id = stack.pop()!;
      group.push(id);
      for (const e of adj.get(id)!) for (const n of ends(e)) if (!seen.has(n)) { seen.add(n); stack.push(n); }
    }
    families.push(group);
  }
  families.sort((a, b) => b.length - a.length || byBirth(byId.get(firstBorn(a, byId))!, byId.get(firstBorn(b, byId))!));

  const nodes: LaidNode[] = [];
  const clusters: TreeLayout["clusters"] = [];
  let left = 0;
  let height = 0;
  families.forEach((group, index) => {
    const gen = generations(group, adj, byId);
    const rows = orderRows(group, gen, adj, byId);
    const widest = Math.max(...rows.map((r) => r.length));
    rows.forEach((row, g) => {
      const offset = ((widest - row.length) * SLOT_W) / 2;
      row.forEach((id, i) => {
        nodes.push({ id, generation: g, cluster: index, x: left + offset + i * SLOT_W + SLOT_W / 2, y: g * ROW_H + ROW_H / 2 });
      });
    });
    clusters.push({ index, size: group.length, left, right: left + widest * SLOT_W });
    height = Math.max(height, rows.length * ROW_H);
    left += widest * SLOT_W + CLUSTER_GAP;
  });
  return { nodes, edges, clusters, width: Math.max(0, left - CLUSTER_GAP), height };
}

function firstBorn(group: string[], byId: Map<string, TreePerson>): string {
  return [...group].sort((a, b) => byBirth(byId.get(a)!, byId.get(b)!))[0]!;
}

/** Each person's generation, the family's oldest at 0 before normalising; OTHER places nobody. */
export function generations(group: readonly string[], adj: Map<string, TreeEdge[]>, byId: Map<string, TreePerson>): Map<string, number> {
  const gen = new Map<string, number>();
  const start = firstBorn([...group], byId);
  const placeFrom = (root: string, at: number) => {
    gen.set(root, at);
    const queue = [root];
    while (queue.length) {
      const id = queue.shift()!;
      const g = gen.get(id)!;
      for (const e of adj.get(id)!) {
        if (e.kind === "other") continue;
        const [x, y] = ends(e);
        const other = x === id ? y : x;
        if (gen.has(other)) continue;
        const step = e.kind === "parent" ? (e.parent === id ? 1 : -1) : 0;
        gen.set(other, g + step);
        queue.push(other);
      }
    }
  };
  placeFrom(start, 0);
  // A person reached only through OTHER stands in the row of whom they are tied to, placed by nothing else.
  let moved = true;
  while (moved) {
    moved = false;
    for (const id of group) {
      if (gen.has(id)) continue;
      const near = adj.get(id)!.map((e) => ends(e).find((n) => n !== id)!).find((n) => gen.has(n));
      if (near !== undefined) {
        placeFrom(id, gen.get(near)!);
        moved = true;
      }
    }
  }
  for (const id of group) if (!gen.has(id)) placeFrom(id, 0);
  const min = Math.min(...gen.values());
  for (const [id, g] of gen) gen.set(id, g - min);
  return gen;
}

/** The rows, top to bottom: children under their parents, siblings in birth order, a spouse beside their partner. */
export function orderRows(
  group: readonly string[],
  gen: Map<string, number>,
  adj: Map<string, TreeEdge[]>,
  byId: Map<string, TreePerson>,
): string[][] {
  const depth = Math.max(...group.map((id) => gen.get(id)!)) + 1;
  const rows: string[][] = Array.from({ length: depth }, () => []);
  const place = new Map<string, number>();
  /** `id`'s neighbours along one kind of tie — for "parent", its parents (`as` "parent") or its children. */
  const neighbours = (id: string, kind: TreeEdge["kind"], as?: "parent" | "child"): string[] =>
    adj.get(id)!.flatMap((e) => {
      if (e.kind !== kind) return [];
      if (e.kind === "parent") {
        if (as === "parent") return e.child === id ? [e.parent] : [];
        return e.parent === id ? [e.child] : [];
      }
      return e.a === id ? [e.b] : e.b === id ? [e.a] : [];
    });
  for (let g = 0; g < depth; g++) {
    const members = group.filter((id) => gen.get(id) === g);
    const key = new Map<string, number>();
    const parentKey = (id: string) => {
      const ps = neighbours(id, "parent", "parent").filter((p) => place.has(p));
      return ps.length ? ps.reduce((s, p) => s + place.get(p)!, 0) / ps.length : null;
    };
    for (const id of members) {
      const k = parentKey(id);
      if (k !== null) key.set(id, k);
    }
    // An in-law has no parents above: they take their partner's place, then a sibling's.
    for (const kind of ["spouse", "sibling"] as const) {
      for (const id of members) {
        if (key.has(id)) continue;
        const n = neighbours(id, kind).find((x) => key.has(x) && gen.get(x) === g);
        if (n !== undefined) key.set(id, key.get(n)! + (kind === "spouse" ? 0.5 : 0));
      }
    }
    const sorted = [...members].sort((a, b) => {
      const ka = key.get(a) ?? Number.POSITIVE_INFINITY;
      const kb = key.get(b) ?? Number.POSITIVE_INFINITY;
      if (ka !== kb) return ka - kb;
      return byBirth(byId.get(a)!, byId.get(b)!);
    });
    const row: string[] = [];
    const putSpouses = (id: string) => {
      for (const s of neighbours(id, "spouse").sort((a, b) => byBirth(byId.get(a)!, byId.get(b)!))) {
        if (gen.get(s) !== g || row.includes(s)) continue;
        // A spouse with parents of their own in this family keeps their own place.
        if (neighbours(s, "parent", "parent").some((p) => place.has(p)) && key.get(s) !== key.get(id)) continue;
        row.push(s);
      }
    };
    for (const id of sorted) {
      if (row.includes(id)) continue;
      row.push(id);
      putSpouses(id);
    }
    rows[g] = row;
    // Places are compared across rows centred, as the rows are drawn.
    const widestSoFar = Math.max(...rows.slice(0, g + 1).map((r) => r.length));
    rows.slice(0, g + 1).forEach((r) => r.forEach((id, i) => place.set(id, i + (widestSoFar - r.length) / 2)));
  }
  return rows;
}

// ── What a node says, at each level ─────────────────────────────────────────────

/** The three zoom levels (#39.11's Ask first 1): far — a node and a short name; middle — name and year; near — more. */
export type TreeLevel = 1 | 2 | 3;
export const LEVEL_2_AT = 0.55;
export const LEVEL_3_AT = 1.1;
export const MIN_SCALE = 0.15;
export const MAX_SCALE = 2.5;

export function levelAt(scale: number): TreeLevel {
  return scale < LEVEL_2_AT ? 1 : scale < LEVEL_3_AT ? 2 : 3;
}

/** A short name for the far level: the first name, else the name's first word, at most 12 characters. */
export function shortName(p: TreePerson): string {
  const base = (p.firstName?.trim() || p.displayName.trim().split(/\s+/)[0] || "").trim();
  return base.length > 12 ? `${base.slice(0, 11)}…` : base;
}

/** „1948" from „1948-03-12", or null. */
export function birthYear(p: TreePerson): string | null {
  return p.dateOfBirth && /^\d{4}/.test(p.dateOfBirth) ? p.dateOfBirth.slice(0, 4) : null;
}

/** „12.03.1948" from „1948-03-12", or null. */
export function birthDate(p: TreePerson): string | null {
  const m = p.dateOfBirth ? /^(\d{4})-(\d{2})-(\d{2})/.exec(p.dateOfBirth) : null;
  return m ? `${m[3]}.${m[2]}.${m[1]}` : null;
}

/** Slice #39.30: „03.02.1998" from a dead person's date of death, or null (alive, or the date unknown). */
export function deathDate(p: TreePerson): string | null {
  const m = p.isDeceased && p.dateOfDeath ? /^(\d{4})-(\d{2})-(\d{2})/.exec(p.dateOfDeath) : null;
  return m ? `${m[3]}.${m[2]}.${m[1]}` : null;
}

/**
 * Slice #39.30: a dead person's years as a genealogy writes them under the name — „1921–1998"; „1921–?" when the
 * date of death is unknown, „?–1998" when the birth is. Null for the living (their line stays „n. 1921").
 */
export function lifeYears(p: TreePerson): string | null {
  if (!p.isDeceased) return null;
  const died = p.dateOfDeath && /^\d{4}/.test(p.dateOfDeath) ? p.dateOfDeath.slice(0, 4) : null;
  return `${birthYear(p) ?? "?"}–${died ?? "?"}`;
}
