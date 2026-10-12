/**
 * Slice #39.12 — one person's tree (`personSubtree`), the roles C offers (`familyRoles`), and where the links go.
 */
import fs from "fs";
import path from "path";

import type { TreePerson, TreeTie } from "@/lib/inheritance/layout";
import { familyRoles, personSubtree } from "@/lib/inheritance/subtree";
import { personTreeHref, readTree, wholeTreeHref } from "@/lib/inheritance/links";

const ROLE = { name: "R", converseName: null, converseNameMale: null, converseNameFemale: null };
let n = 0;
const p = (id: string): TreePerson => ({ id, displayName: id, firstName: id, lastName: null, nickname: null, gender: null, dateOfBirth: null });
const tie = (holder: string, k: string, other: string): TreeTie => {
  const [a, b] = [holder, other].sort();
  return { id: `t${++n}`, personIdA: a, personIdB: b, roleReadsAToB: holder === a, kinship: k, role: ROLE };
};
const ids = (r: { persons: TreePerson[] }) => r.persons.map((x) => x.id).sort();

describe("personSubtree — who the person's tile draws", () => {
  // Five generations: g4 → g3 → g2 (grandparent) → P1 → me → c1 → gc1 → ggc1 → gggc1, with spouses, siblings,
  // an uncle and a cousin who stay out.
  const people = ["g4", "g3", "g2", "P1", "P2", "me", "sp", "sib", "half", "uncle", "cousin", "c1", "c1sp", "gc1", "ggc1", "gggc1", "nephew", "x"].map(p);
  const ties = [
    tie("g4", "PARENT", "g3"),
    tie("g3", "PARENT", "g2"),
    tie("g2", "PARENT", "P1"),
    tie("g2", "PARENT", "uncle"),
    tie("uncle", "PARENT", "cousin"),
    tie("P1", "PARENT", "me"),
    tie("P2", "PARENT", "me"),
    tie("P1", "SPOUSE", "P2"),
    tie("P1", "PARENT", "sib"),
    tie("sib", "PARENT", "nephew"),
    tie("half", "SIBLING", "me"),
    tie("me", "SPOUSE", "sp"),
    tie("me", "PARENT", "c1"),
    tie("c1sp", "SPOUSE", "c1"),
    tie("c1", "PARENT", "gc1"),
    tie("gc1", "PARENT", "ggc1"),
    tie("ggc1", "PARENT", "gggc1"),
  ];
  const mine = personSubtree("me", people, ties);

  it("up to great-grandparents, down to great-grandchildren", () => {
    expect(ids(mine)).toContain("g3");
    expect(ids(mine)).not.toContain("g4");
    expect(ids(mine)).toContain("ggc1");
    expect(ids(mine)).not.toContain("gggc1");
  });
  it("siblings — by a parent in common or by a tie — and every spouse of those in", () => {
    expect(ids(mine)).toEqual(expect.arrayContaining(["sib", "half", "sp", "P2", "c1sp"]));
  });
  it("not the uncle, the cousin, a sibling's child, or anyone unrelated", () => {
    for (const out of ["uncle", "cousin", "nephew", "x"]) expect(ids(mine)).not.toContain(out);
  });
  it("only the ties between those drawn", () => {
    const drawn = new Set(ids(mine));
    for (const t of mine.ties) expect([drawn.has(t.personIdA), drawn.has(t.personIdB)]).toEqual([true, true]);
    expect(mine.ties.some((t) => [t.personIdA, t.personIdB].includes("uncle"))).toBe(false);
  });
  it("a person with no tie is alone", () => {
    expect(personSubtree("x", people, ties)).toEqual({ persons: [p("x")], ties: [] });
  });
  it("an other relative of the person is in", () => {
    const r = personSubtree("a", [p("a"), p("b")], [tie("b", "OTHER", "a")]);
    expect(ids(r)).toEqual(["a", "b"]);
  });
});

describe("familyRoles — C offers only person-to-person roles with a kinship", () => {
  it("filters and sorts by name", () => {
    const roles = [
      { name: "Tată", validForPerson: true, kinship: "PARENT" },
      { name: "Coproprietar", validForPerson: true, kinship: null },
      { name: "Vânzător", validForPerson: false, kinship: null },
      { name: "Bunic", validForPerson: true, kinship: "OTHER" },
      { name: "Ciudat", validForPerson: false, kinship: "CHILD" },
    ];
    expect(familyRoles(roles).map((r) => r.name)).toEqual(["Bunic", "Tată"]);
  });
});

describe("the links", () => {
  it("a name in the whole tree expands the tree's C; the tile's button opens the whole tree on the person", () => {
    expect(personTreeHref("a b")).toBe("/natural-persons/a%20b?tree=open");
    expect([readTree("open"), readTree(null), readTree("new")]).toEqual([true, false, false]);
    expect(wholeTreeHref("x")).toBe("/inheritance-tree?focus=x");
    expect(wholeTreeHref()).toBe("/inheritance-tree");
  });
  it("39.11's screen links names that way", () => {
    const screen = fs.readFileSync(path.join(process.cwd(), "src/components/inheritance/tree-canvas.tsx"), "utf8");
    expect(screen).toContain("personTreeHref(");
  });
});

describe("the tile — a square as wide as „Identitate”, light blue, ticked by default", () => {
  const read = (f: string) => fs.readFileSync(path.join(process.cwd(), f), "utf8");
  it("is as wide as the identity tile and its drawing is square", () => {
    expect(read("src/app/natural-persons/_components/person-detail-tiles.tsx")).toContain("units={PANEL_UNITS.naturalPerson.identity}");
    const tile = read("src/app/_components/person-tree-tile.tsx");
    expect(tile).toContain("style={unitStyle(units)}");
    expect(tile).toMatch(/className="relative aspect-square w-full/);
  });
  it("C writes only through the association route", () => {
    const tile = read("src/app/_components/person-tree-tile.tsx");
    const urls = [...tile.matchAll(/fetch\(`([^`]+)`/g)].map((m) => m[1]);
    expect(urls.filter((u) => !u.startsWith("/api/people?q="))).toEqual([
      "/api/people/${encodeURIComponent(personId)}/references",
      "/api/people/${encodeURIComponent(personId)}/references/${encodeURIComponent(otherId)}",
    ]);
  });
});
