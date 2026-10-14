/**
 * Where each person stands, and where each family's line runs — pure.                (Slice #39.34)
 *
 * Adrian, 2026-10-14 (Correction.01.Inheritance.Tree): every family's sibling bar was drawn at the same height
 * between two generations, so the bars lay on top of each other, and a child's line seemed to reach the wrong
 * parents first; and the children of a row were spread evenly under the whole row instead of under their own
 * parents. The genealogy charts' answer (Gramps, FamilySearch's descendancy view) and the layered-graph one
 * (Sugiyama's coordinate assignment), which this module follows:
 *
 *   1. ORDER is #39.11's (`orderRows`): a family's children together, in birth order, under their parents' place.
 *   2. PLACES are solved, not dealt out. In each row, every person wants an x — a child the middle of their
 *      parents, a parent the middle of their children (a couple half a slot either side of it), an in-law beside
 *      their partner — and `packRow` gives the row the x's closest to what they want with the row's order kept
 *      and a slot between neighbours. Rows are swept down and up until they settle, and down once more, so the
 *      last word is the children's: under their parents wherever the row allows (Ask first 1 — clusters move
 *      apart before a child moves away from its parents; a wider tree is fine, a misleading one is not).
 *   3. LANES: each family's horizontal run between two generations gets a height of its own when its x-range
 *      meets another's (`LANE_GAP` apart, Ask first 2); runs that do not meet share a height. Where more lanes
 *      are needed than the gap between two rows holds, the gap grows.
 *   4. TURNS are quarter-circle arcs of `CORNER_R` (`runPath`), never corners.
 */
import { SLOT_W } from "./layout-constants";

/** Between two families' runs, and their distance from each other along x (Ask first 2: about 8 px at scale 1). */
export const LANE_GAP = 8;
/** A turn's radius (Ask first 2: about 6 px at scale 1). */
export const CORNER_R = 6;
/** How many lanes the plain gap between two rows holds before it grows. */
export const FREE_LANES = 3;

/**
 * The x's closest to `desired` (least squares, weighted) that keep the row's order and at least `gap` between
 * neighbours: with y_i = x_i − i·gap the constraint is „y never decreases", which is isotonic regression —
 * solved exactly by pooling adjacent violators.
 */
export function packRow(desired: readonly number[], weight: readonly number[], gap: number): number[] {
  const blocks: { v: number; w: number; n: number }[] = [];
  desired.forEach((d, i) => {
    blocks.push({ v: d - i * gap, w: Math.max(weight[i] ?? 1, 1e-6), n: 1 });
    while (blocks.length > 1 && blocks[blocks.length - 2]!.v > blocks[blocks.length - 1]!.v) {
      const b = blocks.pop()!;
      const a = blocks.pop()!;
      blocks.push({ v: (a.v * a.w + b.v * b.w) / (a.w + b.w), w: a.w + b.w, n: a.n + b.n });
    }
  });
  const out: number[] = [];
  for (const b of blocks) for (let k = 0; k < b.n; k++) out.push(b.v + out.length * gap);
  return out;
}

export type Kin = {
  parentsOf: (id: string) => readonly string[];
  childrenOf: (id: string) => readonly string[];
  spousesOf: (id: string) => readonly string[];
};

const mean = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
const SWEEPS = 16;

/** Each person's x in one family, rows top to bottom; the origin is arbitrary (the caller shifts the family). */
export function placeRows(rows: readonly (readonly string[])[], kin: Kin): Map<string, number> {
  const row = new Map<string, number>();
  rows.forEach((r, g) => r.forEach((id) => row.set(id, g)));
  const widest = Math.max(0, ...rows.map((r) => r.length));
  const x = new Map<string, number>();
  rows.forEach((r) => r.forEach((id, i) => x.set(id, (i + (widest - r.length) / 2) * SLOT_W)));

  /** The partner beside `id` in its row, with their index — a couple stays side by side. */
  const partnerBeside = (r: readonly string[], i: number): number | null => {
    for (const j of [i - 1, i + 1]) if (j >= 0 && j < r.length && kin.spousesOf(r[i]!).includes(r[j]!)) return j;
    return null;
  };
  const besidePartner = (r: readonly string[], i: number): [number, number] | null => {
    const j = partnerBeside(r, i);
    return j === null ? null : [x.get(r[j]!)! + (i < j ? -SLOT_W : SLOT_W), 0.25];
  };
  const solve = (g: number, want: (r: readonly string[], i: number) => [number, number]) => {
    const r = rows[g]!;
    if (r.length === 0) return;
    const dw = r.map((_, i) => want(r, i));
    packRow(dw.map((d) => d[0]), dw.map((d) => d[1]), SLOT_W).forEach((v, i) => x.set(r[i]!, v));
  };
  const down = (g: number) =>
    solve(g, (r, i) => {
      const ps = kin.parentsOf(r[i]!).filter((p) => (row.get(p) ?? g) < g);
      if (ps.length) return [mean(ps.map((p) => x.get(p)!)), 1];
      return besidePartner(r, i) ?? [x.get(r[i]!)!, 0.02];
    });
  const up = (g: number) =>
    solve(g, (r, i) => {
      const cs = kin.childrenOf(r[i]!).filter((c) => (row.get(c) ?? g) > g);
      if (cs.length) {
        const m = mean(cs.map((c) => x.get(c)!));
        const j = partnerBeside(r, i);
        const shared = j !== null && kin.childrenOf(r[j]!).some((c) => cs.includes(c));
        return [shared ? m + (i < j! ? -SLOT_W / 2 : SLOT_W / 2) : m, 1];
      }
      return besidePartner(r, i) ?? [x.get(r[i]!)!, 0.02];
    });
  for (let s = 0; s < SWEEPS; s++) {
    for (let g = 1; g < rows.length; g++) down(g);
    for (let g = rows.length - 2; g >= 0; g--) up(g);
  }
  for (let g = 1; g < rows.length; g++) down(g);
  return x;
}

/** One family's line: from its parents (between them, for a couple) down to a lane, along it, down to each child. */
export type FamilyRun = {
  key: string;
  parents: string[];
  from: { x: number; y: number };
  /** The generation the line leaves from — the lane is in the gap under it. */
  gap: number;
  laneY: number;
  /** Which lane of its gap, 0 nearest the parents. */
  lane: number;
  children: { id: string; x: number; y: number }[];
};

/** A run's x-range, the turns included. */
export function runSpan(run: Pick<FamilyRun, "from" | "children">): [number, number] {
  const xs = [run.from.x, ...run.children.map((c) => c.x)];
  return [Math.min(...xs) - CORNER_R, Math.max(...xs) + CORNER_R];
}

/** Lanes for the runs of one gap: the lowest free one, a lane free when its last run ends `LANE_GAP` before. */
export function assignLanes(spans: readonly [number, number][]): number[] {
  const order = spans.map((s, i) => i).sort((a, b) => spans[a]![0] - spans[b]![0] || spans[a]![1] - spans[b]![1]);
  const ends: number[] = [];
  const lane: number[] = new Array(spans.length).fill(0);
  for (const i of order) {
    const [lo, hi] = spans[i]!;
    let l = ends.findIndex((e) => e + LANE_GAP <= lo);
    if (l < 0) l = ends.length;
    ends[l] = hi;
    lane[i] = l;
  }
  return lane;
}

/** The extra height a gap needs for `lanes` lanes. */
export const gapExtra = (lanes: number) => Math.max(0, lanes - FREE_LANES) * LANE_GAP;

/**
 * The path from a run's start to one child: down to the lane, a quarter-circle turn, along the lane, another
 * turn, down to the child. Straight down when the child is under the start; plain right angles only when the
 * data is contradictory (a child not below the lane), where a turn has no room to be round.
 */
export function runPath(from: { x: number; y: number }, laneY: number, to: { x: number; y: number }, r = CORNER_R): string {
  const dx = to.x - from.x;
  if (Math.abs(dx) < 0.5) return `M ${from.x} ${from.y} V ${to.y}`;
  if (!(from.y < laneY && laneY < to.y)) return `M ${from.x} ${from.y} V ${laneY} H ${to.x} V ${to.y}`;
  const dir = dx > 0 ? 1 : -1;
  const rr = Math.min(r, Math.abs(dx) / 2, laneY - from.y, to.y - laneY);
  // Heading down then along: a turn to the left when going right (sweep 0), to the right when going left.
  const first = dir > 0 ? 0 : 1;
  return [
    `M ${from.x} ${from.y}`,
    `V ${laneY - rr}`,
    `A ${rr} ${rr} 0 0 ${first} ${from.x + dir * rr} ${laneY}`,
    `H ${to.x - dir * rr}`,
    `A ${rr} ${rr} 0 0 ${1 - first} ${to.x} ${laneY + rr}`,
    `V ${to.y}`,
  ].join(" ");
}

