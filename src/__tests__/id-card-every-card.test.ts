/**
 * Slice #38.44 — every identity card the import recognises goes through
 * „Creează persoană din CI", with a property or without one.
 *
 * - the general reader never reads a recognised card (Ask first 3);
 * - the queue takes a card whatever its property, and the dialog links the
 *   holder to the property only when there is one;
 * - the holder goes onto the card's Document as „Titular act de identitate";
 * - both parent rows are offered when the read names none (Ask first 2).
 */
import fs from "node:fs";
import path from "node:path";
import type { FSEntry } from "@/lib/import/folder-utils";
import { interpretSkipReason } from "@/lib/import/ai-interpret-run";
import { ID_CARD_HOLDER_ROLE, holderRoleIdFrom } from "@/lib/import/id-card-holder-role";
import { offeredDrafts } from "@/lib/import/id-card-parents";

const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("the general reader and cards (Ask first 3)", () => {
  const card = { kind: "file", name: "CI.jpg", path: "A/flotante/CI.jpg", pathParts: ["flotante"], handle: { name: "CI.jpg" } } as unknown as FSEntry;
  it("never reads a card the scan recognises — with a property or without", () => {
    expect(interpretSkipReason(card, { isIdCard: true })).toBe("id-card");
  });
  it("a card the scan missed is still read", () => {
    expect(interpretSkipReason(card, { isIdCard: false })).toBeNull();
  });
});

describe("the queue and the link step", () => {
  const bulk = code(read("src", "app", "admin", "import", "_components", "bulk-import-dialog.tsx"));
  const dialog = code(read("src", "app", "admin", "import", "_components", "id-card-person-dialog.tsx"));
  it("queues every recognised card, its property or none", () => {
    expect(bulk).not.toMatch(/isIdCardEntry\(sr\)\s*&&\s*rowProperty\s*!==\s*null/);
    expect(bulk).toMatch(/if \(isIdCardEntry\(sr\)\) \{/);
    expect(bulk).toMatch(/propertyId:\s*rowProperty,/);
  });
  it("links the holder to a property only when there is one, and always to the Document in the holder role", () => {
    expect(dialog).toMatch(/propertyId:\s*string \| null;/);
    expect(dialog).toMatch(/if \(propertyId !== null\) \{[\s\S]*?\/api\/properties\//);
    expect(dialog).toContain("holderRoleIdFor(documentId)");
    expect(dialog).toContain("personRoleId: holderRoleId");
  });
});

describe("the holder role", () => {
  it("is found by name, whatever its case and spacing", () => {
    expect(ID_CARD_HOLDER_ROLE).toBe("Titular act de identitate");
    expect(holderRoleIdFrom([{ id: "a", name: "Notar" }, { id: "b", name: " titular act de identitate " }])).toBe("b");
  });
  it("is none when the type does not offer it — the link is then made without a role", () => {
    expect(holderRoleIdFrom([{ id: "a", name: "Notar" }])).toBeNull();
    expect(holderRoleIdFrom([])).toBeNull();
  });
});

describe("the parents offered (Ask first 2)", () => {
  it("both read: both ticked, the holder's surname assumed", () => {
    expect(offeredDrafts({ father: "Ion", mother: "Maria" }, "Popescu")).toEqual([
      { kind: "FATHER", checked: true, firstName: "Ion", lastName: "Popescu", surnameAssumed: true },
      { kind: "MOTHER", checked: true, firstName: "Maria", lastName: "Popescu", surnameAssumed: true },
    ]);
  });
  it("one read: it ticked, the other offered empty", () => {
    expect(offeredDrafts({ father: null, mother: "Maria" }, "Popescu")).toEqual([
      { kind: "FATHER", checked: false, firstName: "", lastName: "Popescu", surnameAssumed: true },
      { kind: "MOTHER", checked: true, firstName: "Maria", lastName: "Popescu", surnameAssumed: true },
    ]);
  });
  it("none read: both offered empty and unticked", () => {
    expect(offeredDrafts({ father: null, mother: null }, "Popescu").map((d) => [d.kind, d.checked, d.firstName])).toEqual([
      ["FATHER", false, ""],
      ["MOTHER", false, ""],
    ]);
  });
});

describe("the action on a card's screen (Ask first 1)", () => {
  const form = code(read("src", "app", "documents", "_components", "document-form.tsx"));
  it("is drawn on an identity card's screen only", () => {
    expect(form).toMatch(/documentTypeIsIdCard\(/);
    expect(form).toContain("<IdCardPeopleAction");
  });
  it("opens the import's own dialog, with no property", () => {
    const action = code(read("src", "app", "documents", "_components", "id-card-people-action.tsx"));
    expect(action).toContain("<IdCardPersonDialog");
    expect(action).toMatch(/propertyId=\{null\}/);
  });
});
