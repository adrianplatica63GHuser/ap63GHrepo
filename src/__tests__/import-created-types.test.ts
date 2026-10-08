/**
 * #38.52 — which document types „Creat la import" are deleted, which are held.
 * The module is src/lib/admin/value-lists/import-created-types.ts.
 */

import {
  describeType,
  isImportCreatedType,
  planImportCreatedRemoval,
  type DocumentTypeRow,
} from "@/lib/admin/value-lists/import-created-types";

const FORM = [{ key: "nr", label: "Număr", type: "text" }];

function row(id: string, name: string, origin: string, templateFields: unknown = []): DocumentTypeRow {
  return { id, name, key: name.toUpperCase().replace(/\s+/g, "_"), origin, templateFields };
}

describe("isImportCreatedType — the status's own rule", () => {
  it("is origin IMPORT with no form", () => {
    expect(isImportCreatedType(row("a", "Scanat", "IMPORT"))).toBe(true);
    expect(isImportCreatedType(row("a", "Scanat", "IMPORT", null))).toBe(true);
  });
  it("is not a type added by hand", () => {
    expect(isImportCreatedType(row("a", "Manual", "MANUAL"))).toBe(false);
    expect(isImportCreatedType({ id: "a", name: "Fără origine" })).toBe(false);
  });
  it("is not an imported type that has since been given a form", () => {
    expect(isImportCreatedType(row("a", "Completat", "IMPORT", FORM))).toBe(false);
  });
});

describe("planImportCreatedRemoval", () => {
  const rows = [
    row("1", "Zeta import", "IMPORT"),
    row("2", "Alfa import", "IMPORT"),
    row("3", "Folosit import", "IMPORT"),
    row("4", "Manual nefolosit", "MANUAL"),
    row("5", "Import cu formular", "IMPORT", FORM),
    row("6", "Necunoscut import", "IMPORT"),
  ];
  const usage = { "1": 0, "2": 0, "3": 4, "4": 0, "5": 0 };
  const plan = planImportCreatedRemoval(rows, usage);

  it("deletes exactly the unused „Creat la import” types, by name", () => {
    expect(plan.remove.map((r) => r.id)).toEqual(["2", "1"]);
  });
  it("holds back a used one with its count, and one whose use is unknown", () => {
    expect(plan.hold.map((h) => [h.row.id, h.usedBy])).toEqual([
      ["3", 4],
      ["6", null],
    ]);
  });
  it("never touches a manual type or an imported type with a form", () => {
    const touched = [...plan.remove.map((r) => r.id), ...plan.hold.map((h) => h.row.id)];
    expect(touched).not.toContain("4");
    expect(touched).not.toContain("5");
  });
  it("is empty when nothing was imported", () => {
    expect(planImportCreatedRemoval([row("4", "Manual", "MANUAL")], { "4": 0 })).toEqual({ remove: [], hold: [] });
  });
});

describe("describeType", () => {
  it("names the row, its key and its use", () => {
    expect(describeType(row("1", "Act nou", "IMPORT"), 3)).toBe("Act nou [ACT_NOU] — folosit de 3");
    expect(describeType({ id: "1", name: "Fără cheie" }, null)).toBe("Fără cheie — folosit de ?");
  });
});
