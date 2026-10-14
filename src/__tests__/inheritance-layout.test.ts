/**
 * Slice #39.11 — the inheritance tree's layout (`@/lib/inheritance/layout`): who is drawn, generations from PARENT,
 * spouses side by side, siblings in birth order, separate families as clusters, and what each level says.
 */
import {
  LEVEL_2_AT,
  LEVEL_3_AT,
  birthDate,
  birthYear,
  edgeOf,
  layoutTree,
  levelAt,
  shortName,
  tieAlong,
  type TreePerson,
  type TreeTie,
} from "@/lib/inheritance/layout";

const ROLE = { name: "R", converseName: null, converseNameMale: null, converseNameFemale: null };
let n = 0;
const person = (id: string, dateOfBirth: string | null = null, gender: "MALE" | "FEMALE" | null = null): TreePerson => ({
  id, displayName: `${id} Popescu`, firstName: id, lastName: "Popescu", nickname: null, gender, dateOfBirth,
});
/** `holder` holds a role with kinship `k` towards `other`; the pair stored in uuid order, as the database does. */
const tie = (holder: string, k: string, other: string): TreeTie => {
  const [a, b] = [holder, other].sort();
  return { id: `t${++n}`, personIdA: a, personIdB: b, roleReadsAToB: holder === a, kinship: k, role: ROLE };
};
const rowsOf = (l: ReturnType<typeof layoutTree>) => {
  const rows = new Map<string, { id: string; x: number }[]>();
  for (const nd of l.nodes) {
    const key = `${nd.cluster}:${nd.generation}`;
    rows.set(key, [...(rows.get(key) ?? []), { id: nd.id, x: nd.x }]);
  }
  return Object.fromEntries([...rows].map(([k, v]) => [k, v.sort((a, b) => a.x - b.x).map((x) => x.id)]));
};

describe("a tie as a line", () => {
  it("PARENT: the holder above; CHILD: the other above — whichever end of the pair holds it", () => {
    expect(edgeOf(tie("G", "PARENT", "P"))).toMatchObject({ kind: "parent", parent: "G", child: "P" });
    expect(edgeOf(tie("P", "PARENT", "G"))).toMatchObject({ kind: "parent", parent: "P", child: "G" });
    expect(edgeOf(tie("C", "CHILD", "M"))).toMatchObject({ kind: "parent", parent: "M", child: "C" });
    expect(edgeOf(tie("A", "SPOUSE", "B"))).toMatchObject({ kind: "spouse" });
    expect(edgeOf(tie("A", "SIBLING", "B"))).toMatchObject({ kind: "sibling" });
    expect(edgeOf(tie("A", "OTHER", "B"))).toMatchObject({ kind: "other" });
    expect(edgeOf({ ...tie("A", "PARENT", "B"), kinship: "COUSIN" })).toBeNull();
  });
  it("reads back the tie from each end", () => {
    const e = edgeOf(tie("G", "PARENT", "P"))!;
    expect([tieAlong(e, "G"), tieAlong(e, "P")]).toEqual(["PARENT", "CHILD"]);
  });
});

describe("five people on three generations", () => {
  // A grandparent, a couple, their child and the child's spouse — TC-INHER-01's family.
  const people = [person("G", "1920-01-01"), person("P", "1950-01-01"), person("Q", "1952-01-01"), person("C", "1980-01-01"), person("S", "1981-01-01")];
  const ties = [tie("G", "PARENT", "P"), tie("P", "SPOUSE", "Q"), tie("P", "PARENT", "C"), tie("Q", "PARENT", "C"), tie("S", "SPOUSE", "C")];
  const l = layoutTree(people, ties);

  it("generations from PARENT, spouses on their partner's row", () => {
    expect(rowsOf(l)).toEqual({ "0:0": ["G"], "0:1": ["P", "Q"], "0:2": ["C", "S"] });
  });
  it("one cluster, three rows", () => {
    // #39.34: C stands under the middle of P and Q, S beside C — a slot wider than #39.11's evenly dealt rows.
    expect(l.clusters).toEqual([{ index: 0, size: 5, left: 0, right: 500 }]);
    expect(l.height).toBe(450);
    const x = Object.fromEntries(l.nodes.map((nd) => [nd.id, nd.x]));
    expect(x.C).toBe((x.P! + x.Q!) / 2);
    expect(x.G).toBe(x.P);
  });
  it("draws every tie", () => {
    expect(l.edges.map((e) => e.kind).sort()).toEqual(["parent", "parent", "parent", "spouse", "spouse"]);
  });
});

describe("siblings, in-laws and the others", () => {
  it("siblings in birth order, an undated one last", () => {
    const people = [person("A", "1950-01-01"), person("B", "1951-01-01"), person("x", "1990-05-05"), person("y", "1985-01-01"), person("z")];
    const ties = ["x", "y", "z"].flatMap((c) => [tie("A", "PARENT", c), tie("B", "PARENT", c)]).concat(tie("A", "SPOUSE", "B"));
    expect(rowsOf(layoutTree(people, ties))["0:1"]).toEqual(["y", "x", "z"]);
  });

  it("a spouse with no parents in the tree stands right beside their partner", () => {
    const people = [person("M", "1950-01-01"), person("a", "1975-01-01"), person("b", "1978-01-01"), person("w", "1976-01-01")];
    const ties = [tie("M", "PARENT", "a"), tie("M", "PARENT", "b"), tie("w", "SPOUSE", "a")];
    expect(rowsOf(layoutTree(people, ties))["0:1"]).toEqual(["a", "w", "b"]);
  });

  it("siblings with no parent drawn share a row", () => {
    const l = layoutTree([person("A", "1960-01-01"), person("B", "1962-01-01")], [tie("A", "SIBLING", "B")]);
    expect(rowsOf(l)).toEqual({ "0:0": ["A", "B"] });
  });

  it("OTHER places no generation: the relative stands in the row of whom they are tied to", () => {
    const people = [person("G", "1920-01-01"), person("P", "1950-01-01"), person("N", "1990-01-01")];
    const l = layoutTree(people, [tie("G", "PARENT", "P"), tie("N", "OTHER", "P")]);
    expect(rowsOf(l)).toEqual({ "0:0": ["G"], "0:1": ["P", "N"] });
    expect(l.edges.find((e) => e.kind === "other")).toBeTruthy();
  });

  it("nobody without a tie, and no tie to someone who is not a person of the tree (a company)", () => {
    const l = layoutTree([person("A"), person("B"), person("lonely")], [tie("A", "SPOUSE", "B"), tie("A", "SPOUSE", "company-1")]);
    expect(l.nodes.map((x) => x.id).sort()).toEqual(["A", "B"]);
    expect(l.edges).toHaveLength(1);
  });

  it("a person who is their own grandparent is drawn, not refused", () => {
    const l = layoutTree([person("A", "1900-01-01"), person("B", "1930-01-01")], [tie("A", "PARENT", "B"), tie("B", "PARENT", "A")]);
    expect(l.nodes).toHaveLength(2);
  });
});

describe("separate families", () => {
  it("each its own cluster, the largest first, side by side", () => {
    const people = [person("a1", "1950-01-01"), person("a2", "1951-01-01"), person("b1", "1930-01-01"), person("b2", "1960-01-01"), person("b3", "1962-01-01")];
    const ties = [tie("a1", "SPOUSE", "a2"), tie("b1", "PARENT", "b2"), tie("b1", "PARENT", "b3")];
    const l = layoutTree(people, ties);
    expect(l.clusters.map((c) => c.size)).toEqual([3, 2]);
    expect(l.clusters[1]!.left).toBe(l.clusters[0]!.right + 160);
    expect(l.nodes.filter((x) => x.cluster === 0).map((x) => x.id).sort()).toEqual(["b1", "b2", "b3"]);
    expect(l.width).toBe(l.clusters[1]!.right);
  });

  it("nothing to draw: an empty layout", () => {
    expect(layoutTree([person("A")], [])).toEqual({ nodes: [], edges: [], clusters: [], runs: [], width: 0, height: 0 });
  });
});

describe("the three levels", () => {
  it("far, middle, near by the zoom", () => {
    expect(levelAt(0.2)).toBe(1);
    expect(levelAt(LEVEL_2_AT - 0.01)).toBe(1);
    expect(levelAt(LEVEL_2_AT)).toBe(2);
    expect(levelAt(LEVEL_3_AT - 0.01)).toBe(2);
    expect(levelAt(LEVEL_3_AT)).toBe(3);
  });
  it("say a short name, the year, the date", () => {
    const p = { ...person("Constantin-Alexandru", "1948-03-12") };
    expect(shortName(p)).toBe("Constantin-…");
    expect(shortName({ ...p, firstName: null, displayName: "Ana Pop" })).toBe("Ana");
    expect(birthYear(p)).toBe("1948");
    expect(birthDate(p)).toBe("12.03.1948");
    expect([birthYear(person("x")), birthDate(person("x"))]).toEqual([null, null]);
  });
});
