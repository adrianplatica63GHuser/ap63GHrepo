/**
 * @jest-environment node
 */

/**
 * „Schimbă tipul…" — what a change of a saved document's type drops, and the wiring that makes it the only way.
 *                                                                                                     (Slice 40.92)
 *
 * The rules are pure and driven for real (src/lib/documents/type-change.ts); the route is driven with its query
 * layer mocked; the form's wiring is read from its source with comments stripped — a BEHAVIOUR guard reads only code.
 */
jest.mock("@/db", () => ({ __esModule: true, db: {} }));
jest.mock("@/lib/documents/queries", () => ({
  __esModule: true,
  listDocumentPersons: jest.fn(),
  listPersonRolesForDocumentType: jest.fn(),
}));

import fs from "node:fs";
import path from "node:path";
import type { NextRequest } from "next/server";
import { stripComments } from "@/lib/dev/strip-comments";
import {
  customFieldsDroppedByType,
  keepsCustomFieldOnRetype,
  partiesStrandedByType,
  type TypeChangeLink,
} from "@/lib/documents/type-change";
import { GET } from "@/app/api/documents/[id]/type-change/route";
import * as documentQ from "@/lib/documents/queries";

const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");

describe("keepsCustomFieldOnRetype — the save's filter", () => {
  const declared = new Set(["pret", "modalitatePlata", "nrActParinte"]);
  it("drops a key another type declares and the new one does not", () => {
    expect(keepsCustomFieldOnRetype("pret", declared, new Set(["nrActParinte"]))).toBe(false);
  });
  it("keeps a key the new type declares", () => {
    expect(keepsCustomFieldOnRetype("nrActParinte", declared, new Set(["nrActParinte"]))).toBe(true);
  });
  it("keeps a key no type declares — an administrator's removed field (#27.04)", () => {
    expect(keepsCustomFieldOnRetype("removedLongAgo", declared, new Set())).toBe(true);
  });
});

describe("customFieldsDroppedByType — the form fields the dialog names", () => {
  const declared = new Set(["pret", "modalitatePlata", "nrActParinte", "onorariuNotarial"]);
  const labels: Record<string, string> = { pret: "Preț", modalitatePlata: "Modalitate plată", onorariuNotarial: "Onorariu notarial" };
  const labelOf = (k: string) => labels[k];

  it("names each filled value the new type drops, by its label", () => {
    const values = { pret: "100000", modalitatePlata: "", onorariuNotarial: "1200", nrActParinte: "TC-1" };
    expect(customFieldsDroppedByType(values, declared, new Set(["nrActParinte", "onorariuNotarial"]), labelOf)).toEqual(["Preț"]);
  });
  it("names nothing for an empty or whitespace value", () => {
    expect(customFieldsDroppedByType({ pret: "  ", modalitatePlata: null }, declared, new Set(), labelOf)).toEqual([]);
  });
  it("keeps a key no type declares out of the list, as the save keeps it", () => {
    expect(customFieldsDroppedByType({ removedLongAgo: "x" }, declared, new Set(), labelOf)).toEqual([]);
  });
  it("shows the key when no type names it, and each label once", () => {
    const twice = new Set(["a", "b"]);
    expect(customFieldsDroppedByType({ a: "1", b: "2" }, twice, new Set(), () => "Același")).toEqual(["Același"]);
    expect(customFieldsDroppedByType({ a: "1" }, twice, new Set(), () => undefined)).toEqual(["a"]);
  });
});

describe("partiesStrandedByType — the parties named and left linked", () => {
  const link = (over: Partial<TypeChangeLink>): TypeChangeLink => ({
    linkId: "l1", id: "p1", code: "PPERS-000001", displayName: "Ion Testescu", personRoleId: "r-seller", roleName: "Vânzător", ...over,
  });
  it("names a link whose role the new type does not allow", () => {
    expect(partiesStrandedByType([link({})], new Set(["r-other"]))).toEqual([
      { linkId: "l1", personId: "p1", code: "PPERS-000001", displayName: "Ion Testescu", roleName: "Vânzător" },
    ]);
  });
  it("leaves out a link whose role is allowed, and a link with no role", () => {
    expect(partiesStrandedByType([link({}), link({ linkId: "l2", personRoleId: null, roleName: null })], new Set(["r-seller"]))).toEqual([]);
  });
  it("strands every roled link on a type with no roles configured (no fallback, D-16(b))", () => {
    expect(partiesStrandedByType([link({}), link({ linkId: "l2", personRoleId: null })], new Set())).toHaveLength(1);
  });
});

describe("GET /api/documents/[id]/type-change", () => {
  const ctx = { params: Promise.resolve({ id: "d0000000-0000-4000-8000-000000000001" }) };
  const req = (q: string) => ({ nextUrl: new URL(`http://localhost/api/documents/x/type-change${q}`) }) as unknown as NextRequest;
  const TYPE = "a0000000-0000-4000-8000-000000000002";

  it("answers the links the new type has no role for", async () => {
    (documentQ.listDocumentPersons as jest.Mock).mockResolvedValue([
      { linkId: "l1", id: "p1", code: "PPERS-1", displayName: "A", personRoleId: "r1", roleName: "Vânzător" },
      { linkId: "l2", id: "p2", code: "PPERS-2", displayName: "B", personRoleId: "r2", roleName: "Cumpărător" },
    ]);
    (documentQ.listPersonRolesForDocumentType as jest.Mock).mockResolvedValue([{ id: "r2", name: "Cumpărător", holdsShare: false }]);
    const res = await GET(req(`?to=${TYPE}`), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ parties: [{ linkId: "l1", personId: "p1", code: "PPERS-1", displayName: "A", roleName: "Vânzător" }] });
    expect(documentQ.listPersonRolesForDocumentType).toHaveBeenCalledWith(TYPE);
  });
  it("refuses a `to` that is not an id", async () => {
    expect((await GET(req("?to=nope"), ctx)).status).toBe(400);
    expect((await GET(req(""), ctx)).status).toBe(400);
  });
});

describe("the wiring (source, comments stripped)", () => {
  const FORM = stripComments(read("src", "app", "documents", "_components", "document-form.tsx"));
  const QUERIES = stripComments(read("src", "lib", "documents", "queries.ts"));

  it("the save filters customFields through the same rule the dialog reads", () => {
    const start = FORM.indexOf("const valuesForSave = ");
    const body = FORM.slice(start, FORM.indexOf("const typeChangeDrops = ", start));
    expect(body).toContain("keepsCustomFieldOnRetype(key, someTypeDeclares, newTypeKeys)");
    expect(FORM).toContain("customFieldsDroppedByType(");
  });

  it("the type's change action is given only on a saved document — a new one keeps the dropdown", () => {
    expect(FORM).toMatch(/changeAction=\{\s*!isCreate && documentId\s*\?/);
    expect(FORM).toContain("<DocumentTypeChange");
  });

  it("a save does not re-check the linked parties — so the dialog names them and leaves them (Ask first 4)", () => {
    const start = QUERIES.indexOf("export async function updateDocument(");
    const end = QUERIES.indexOf("\nexport ", start + 10);
    const body = QUERIES.slice(start, end);
    expect(start).toBeGreaterThan(-1);
    expect(body).not.toMatch(/personDocument|person_document/);
  });
});
