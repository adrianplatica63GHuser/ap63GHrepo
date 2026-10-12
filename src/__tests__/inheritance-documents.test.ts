/**
 * The inheritance tree over time, and the documents behind it (Slice #39.13): the counts, the year filter, the
 * shared count of a pair — and what the route sends of a document, and the switch that starts off.
 */
import fs from "node:fs";
import path from "node:path";
import {
  bornAfter,
  byDate,
  documentDay,
  documentsOf,
  indexDocuments,
  pairKey,
  sharedDocuments,
  yearSpan,
  type TreeAppearance,
  type TreeDocument,
} from "@/lib/inheritance/documents";
import type { TreePerson } from "@/lib/inheritance/layout";

const doc = (id: string, date: string | null, type: string | null = "Contract de vânzare-cumpărare"): TreeDocument => ({
  id,
  type,
  number: null,
  date,
});
const person = (id: string, dateOfBirth: string | null): TreePerson => ({
  id,
  displayName: id,
  firstName: id,
  lastName: null,
  nickname: null,
  gender: null,
  dateOfBirth,
});

const DOCS = [doc("d1", "2001-05-02"), doc("d2", "1999-01-10"), doc("d3", null), doc("d4", "2010-03-03")];
const ON: TreeAppearance[] = [
  { personId: "ion", documentId: "d1" },
  { personId: "ion", documentId: "d2" },
  { personId: "ion", documentId: "d1" }, // a second role on the same document
  { personId: "ana", documentId: "d1" },
  { personId: "ana", documentId: "d3" },
  { personId: "ana", documentId: "d2" },
  { personId: "dan", documentId: "d4" },
  { personId: "ion", documentId: "gone" }, // a document the route did not send
];

describe("the counts — each person's documents, once each, oldest first", () => {
  const index = indexDocuments(DOCS, ON);
  it("counts a document once however many roles the person holds on it", () => {
    expect(documentsOf(index, "ion").map((d) => d.id)).toEqual(["d2", "d1"]);
  });
  it("puts a document with no date last", () => {
    expect(documentsOf(index, "ana").map((d) => d.id)).toEqual(["d2", "d1", "d3"]);
  });
  it("leaves out a document it does not know", () => {
    expect(index.byPerson.get("ion")).not.toContain("gone");
  });
  it("gives a person on no document nothing", () => {
    expect(documentsOf(index, "maria")).toEqual([]);
    expect(index.byPerson.has("maria")).toBe(false);
  });
  it("orders by type when the dates agree", () => {
    expect([doc("b", "2000-01-01", "Titlu"), doc("a", "2000-01-01", "Act")].sort(byDate).map((d) => d.id)).toEqual(["a", "b"]);
    expect([doc("b", null, null), doc("a", null, "Act")].sort(byDate).map((d) => d.id)).toEqual(["b", "a"]);
  });
});

describe("the shared count of a pair", () => {
  const index = indexDocuments(DOCS, ON);
  it("is the documents both are on, oldest first, either way round", () => {
    expect(sharedDocuments(index, "ion", "ana").map((d) => d.id)).toEqual(["d2", "d1"]);
    expect(sharedDocuments(index, "ana", "ion").map((d) => d.id)).toEqual(["d2", "d1"]);
  });
  it("is nothing for a pair with no document in common, or a person with themself", () => {
    expect(sharedDocuments(index, "ion", "dan")).toEqual([]);
    expect(sharedDocuments(index, "ion", "ion")).toEqual([]);
  });
  it("draws one count per pair, whichever end comes first", () => {
    expect(pairKey("b", "a")).toBe(pairKey("a", "b"));
    expect(pairKey("a", "b")).toBe("a|b");
  });
});

describe("the year — whoever was born after it fades", () => {
  it("fades a person born in a later year, not one born in it", () => {
    expect(bornAfter(person("ana", "1982-01-15"), 1981)).toBe(true);
    expect(bornAfter(person("ana", "1982-01-15"), 1982)).toBe(false);
  });
  it("fades nobody today (null), and never a person with no birth date", () => {
    expect(bornAfter(person("ana", "1982-01-15"), null)).toBe(false);
    expect(bornAfter(person("x", null), 1800)).toBe(false);
  });
  it("spans from the earliest birth year to this year", () => {
    const now = new Date("2026-10-12T00:00:00Z");
    expect(yearSpan([person("a", "1955-06-10"), person("b", "1930-04-02"), person("c", null)], now)).toEqual({ min: 1930, max: 2026 });
  });
  it("has no span when nobody has a birth date, so no slider is drawn", () => {
    expect(yearSpan([person("c", null)])).toBeNull();
  });
});

describe("a document's date reads as the archive writes it", () => {
  it("is dd.mm.yyyy, or nothing", () => {
    expect(documentDay("2001-05-02")).toBe("02.05.2001");
    expect(documentDay(null)).toBeNull();
  });
});

describe("what reaches the screen", () => {
  const read = (f: string) => fs.readFileSync(path.join(process.cwd(), f), "utf8");
  it("the route sends a document's type, number and date — not its title", () => {
    const q = read("src/lib/inheritance/queries.ts");
    const select = /\.select\(\{ id: document\.id, type: lookupDocumentType\.name, number: document\.nrDocument, date: document\.dateDocument \}\)/;
    expect(q).toMatch(select);
    expect(q).not.toMatch(/document\.title|importTitle/);
  });
  it("„Acte comune” starts off and the year starts at today", () => {
    const screen = read("src/app/inheritance-tree/_components/inheritance-tree-screen.tsx");
    expect(screen).toContain("const [shared, setShared] = useState(false);");
    expect(screen).toContain("const [year, setYear] = useState<number | null>(null);");
  });
  it("a document opens through the guarded navigation", () => {
    expect(read("src/components/inheritance/tree-canvas.tsx")).toContain("guardedNavigate(`/documents/${encodeURIComponent(d.id)}`)");
  });
});
