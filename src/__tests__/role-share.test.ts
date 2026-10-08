/**
 * @jest-environment node
 */

/**
 * Slice #37.59 — a person's share on a Document only for the roles that hold one.
 *
 *   • `shareCells`: which rows draw „Cotă-parte", „Suprafață echivalentă" and
 *     „Mod de deținere", and which only show them read-only;
 *   • `assertShareMayBeStored` / `assertLinkMayStoreShare`: the database is
 *     mocked, and what is under test is when a share is refused and when it is
 *     not asked about at all;
 *   • the PATCH route refuses a share for a role that holds none (400,
 *     `SHARE_NOT_HELD`, Romanian) and accepts one for a role that holds one;
 *   • every write path asks, and the tile, the linker and the admin screen read
 *     the tick — from the source.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Each `db.select(...)` call answers with the next queued result. */
const mockSelectResults: unknown[][] = [];
let mockSelectCalls = 0;
const chain = (): unknown => {
  const result = () => {
    mockSelectCalls += 1;
    return Promise.resolve(mockSelectResults.shift() ?? []);
  };
  const node: Record<string, unknown> = {};
  for (const m of ["from", "innerJoin", "leftJoin", "where", "orderBy"]) node[m] = () => node;
  node.limit = result;
  node.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => result().then(res, rej);
  return node;
};
const mockUpdateReturning = jest.fn();

jest.mock("@/db", () => ({
  __esModule: true,
  db: {
    select: () => chain(),
    update: () => ({ set: () => ({ where: () => ({ returning: mockUpdateReturning }) }) }),
  },
}));

import type { NextRequest } from "next/server";
import { shareCells, storesShare, type ShareRow } from "@/lib/documents/share-cells";
import { assertLinkMayStoreShare, assertShareMayBeStored, ShareNotHeldError } from "@/lib/documents/share-not-held";
import { shareNotHeldToResponse } from "@/lib/api/errors";
import { PATCH } from "@/app/api/documents/[id]/persons/[personId]/route";

const ROOT = join(__dirname, "..", "..");
const read = (...p: string[]): string => readFileSync(join(ROOT, ...p), "utf8");

const row = (over: Partial<ShareRow>): ShareRow => ({
  personRoleId: "role", holdsShare: false, cotaParte: null, cotaSuprafataMp: null, cotaMod: null, ...over,
});

beforeEach(() => {
  mockSelectResults.length = 0;
  mockSelectCalls = 0;
  mockUpdateReturning.mockReset();
});

describe("shareCells — which rows carry the three share values", () => {
  it("a role that holds a share: editable", () => {
    expect(shareCells(row({ holdsShare: true }))).toBe("edit");
  });
  it("a link with no role: editable, its role is unknown", () => {
    expect(shareCells(row({ personRoleId: null }))).toBe("edit");
  });
  it("a role that holds none and stores nothing: no cells", () => {
    expect(shareCells(row({}))).toBe("none");
  });
  it("a role that holds none but stores a value: shown, read-only — nothing stored is hidden", () => {
    expect(shareCells(row({ cotaParte: 50 }))).toBe("readonly");
    expect(shareCells(row({ cotaSuprafataMp: 100 }))).toBe("readonly");
    expect(shareCells(row({ cotaMod: "INDIVIZIUNE" }))).toBe("readonly");
  });
  it("storesShare is any of the three", () => {
    expect(storesShare({ cotaParte: null, cotaSuprafataMp: null, cotaMod: null })).toBe(false);
    expect(storesShare({ cotaParte: 0, cotaSuprafataMp: null, cotaMod: null })).toBe(true);
  });
});

describe("assertShareMayBeStored — the write side's question", () => {
  it("asks nothing for a link with no role, or for no value", async () => {
    await assertShareMayBeStored(["d1"], null, { cotaParte: 50 });
    await assertShareMayBeStored(["d1"], "r1", { cotaParte: null, cotaSuprafataMp: null, cotaMod: null });
    expect(mockSelectCalls).toBe(0);
  });
  it("accepts a share where the role holds one on the document's type", async () => {
    mockSelectResults.push([{ id: "d1" }]);
    await expect(assertShareMayBeStored(["d1"], "r1", { cotaParte: 50 })).resolves.toBeUndefined();
  });
  it("refuses a share where it does not", async () => {
    mockSelectResults.push([]);
    await expect(assertShareMayBeStored(["d1"], "r1", { cotaParte: 50 })).rejects.toBeInstanceOf(ShareNotHeldError);
  });
  it("refuses, naming the documents, when the role holds a share on some of them only", async () => {
    mockSelectResults.push([{ id: "d1" }]);
    const err = await assertShareMayBeStored(["d1", "d2"], "r1", { cotaMod: "NUME_PROPRIU" }).catch((e) => e);
    expect(err).toBeInstanceOf(ShareNotHeldError);
    expect((err as ShareNotHeldError).documentIds).toEqual(["d2"]);
  });
  it("an existing link: clearing is always allowed; a value asks about its role", async () => {
    await assertLinkMayStoreShare("l1", { cotaParte: null, cotaSuprafataMp: null, cotaMod: null });
    expect(mockSelectCalls).toBe(0);
    mockSelectResults.push([{ documentId: "d1", personRoleId: "r1" }], []);
    await expect(assertLinkMayStoreShare("l1", { cotaParte: 25 })).rejects.toBeInstanceOf(ShareNotHeldError);
  });
});

describe("PATCH /api/documents/[id]/persons/[personId] — the route", () => {
  const LINK = "11111111-1111-4111-8111-111111111111";
  const patch = (body: unknown) =>
    PATCH(
      new Request(`http://x/api/documents/d1/persons/p1?linkId=${LINK}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }) as unknown as NextRequest,
      { params: Promise.resolve({ id: "d1", personId: "p1" }) },
    );

  it("refuses a share for a role that holds none: 400, SHARE_NOT_HELD, in Romanian", async () => {
    mockSelectResults.push([{ documentId: "d1", personRoleId: "notar" }], []);
    const res = await patch({ cotaParte: 50, cotaSuprafataMp: null, cotaMod: null });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("SHARE_NOT_HELD");
    expect(body.error).toMatch(/nu deține o cotă/);
    expect(mockUpdateReturning).not.toHaveBeenCalled();
  });

  it("accepts one for a role that holds one", async () => {
    mockSelectResults.push([{ documentId: "d1", personRoleId: "cumparator" }], [{ id: "d1" }]);
    mockUpdateReturning.mockResolvedValue([{ id: LINK }]);
    const res = await patch({ cotaParte: 50, cotaSuprafataMp: null, cotaMod: "INDIVIZIUNE" });
    expect(res.status).toBe(204);
  });

  it("clears a value on a role that holds none — the way out for a value stored before #37.59", async () => {
    mockUpdateReturning.mockResolvedValue([{ id: LINK }]);
    const res = await patch({ cotaParte: null, cotaSuprafataMp: null, cotaMod: null });
    expect(res.status).toBe(204);
    expect(mockSelectCalls).toBe(0);
  });

  it("shareNotHeldToResponse answers only for its own error", () => {
    expect(shareNotHeldToResponse(new Error("x"))).toBeNull();
    expect(shareNotHeldToResponse(new ShareNotHeldError(["d1"], "r1"))?.status).toBe(400);
  });
});

describe("every path that writes or offers a share reads the tick", () => {
  it("the four write functions ask before they write", () => {
    const docs = read("src", "lib", "documents", "queries.ts");
    const persons = read("src", "lib", "persons", "queries.ts");
    expect(docs).toMatch(/await assertShareMayBeStored\(\[documentId\], personRoleId, cota\);/);
    expect(docs).toMatch(/await assertLinkMayStoreShare\(linkId, cota\);\s*const result = await db\.update\(personDocument\)/);
    expect(persons).toMatch(/await assertShareMayBeStored\(documentIds, personRoleId, cota\);/);
    expect(persons).toMatch(/await assertLinkMayStoreShare\(linkId, cota\);[^\n]*\n\s*const result = await db\.update\(personDocument\)/);
  });

  it("the four write routes answer the refusal as a 400", () => {
    for (const p of [
      ["src", "app", "api", "documents", "[id]", "persons", "route.ts"],
      ["src", "app", "api", "documents", "[id]", "persons", "[personId]", "route.ts"],
      ["src", "app", "api", "people", "[id]", "documents", "route.ts"],
      ["src", "app", "api", "people", "[id]", "documents", "[documentId]", "route.ts"],
    ]) {
      expect([p.join("/"), read(...p).includes("shareNotHeldToResponse(err)")]).toEqual([p.join("/"), true]);
    }
  });

  it("the Document's „Persoane” draws the cells through shareCells, read-only when locked", () => {
    const tab = read("src", "app", "documents", "_components", "document-persons-tab.tsx");
    expect(tab).toMatch(/const cells\s+= shareCells\(item\);/);
    expect(tab.match(/disabled=\{locked \|\| savingId === item\.linkId\}/g) ?? []).toHaveLength(3);
    // #37.64: behind the row's orange „Cotă", which a role that holds no share does not get.
    expect(tab).toMatch(/const shareButton = cells !== "none" && \(/);
    expect(tab).toMatch(/data: \{ "data-share": cells \}/);
    // A value kept read-only on a role that holds no share is not summed into the per-role total.
    expect(tab).toMatch(/\(items \?\? \[\]\)\.filter\(\(i\) => shareCells\(i\) === "edit"\)/);
  });

  it("the list of persons carries the pair's tick, read for the document's own type", () => {
    const docs = read("src", "lib", "documents", "queries.ts");
    expect(docs).toMatch(/holdsShare:\s+lookupDocTypePersonRole\.holdsShare,/);
    expect(docs).toMatch(/eq\(lookupDocTypePersonRole\.documentTypeId, document\.documentTypeId\),\s*eq\(lookupDocTypePersonRole\.personRoleId, personDocument\.personRoleId\)/);
  });

  it("the AI party linker offers the boxes only for a role that holds a share", () => {
    const linker = read("src", "app", "documents", "_components", "ai-party-linker-dialog.tsx");
    expect(linker).toMatch(/const offersShare = !party \|\| party\.personRoleId === null \|\| party\.holdsShare !== false;/);
    expect(linker).toMatch(/\{offersShare && \(\s*<fieldset/);
    expect(linker).toMatch(/if \(!offersShare\) return \{ ok: true, value: \{ cotaParte: null, cotaSuprafataMp: null, cotaMod: null \} \};/);
    const route = read("src", "app", "api", "documents", "[id]", "ai-interpret", "route.ts");
    expect(route).toMatch(/holdsShare:\s+personRoleId !== null && holdsShareById\.get\(personRoleId\) === true,/);
  });

  // Slice #38.36: in the role's own panel, one row per document type — the grid is gone.
  it("the tick is set in the role's panel, beside the document type it qualifies", () => {
    const panel = read("src", "app", "admin", "value-lists", "_components", "role-doc-types.tsx");
    expect(panel).toMatch(/checked=\{pendingShare\[p\.id\] \?\? p\.holdsShare\}/);
    expect(panel).toContain("setPairHoldsShare(id, holdsShare)");
    expect(read("src", "lib", "admin", "doc-type-person-roles", "client.ts")).toMatch(/method: "PATCH"/);
  });

  it("migration_091 adds the column NOT NULL DEFAULT false and ticks only the ownership roles", () => {
    const sql = read("src", "db", "migration_091_doc_type_role_holds_share.sql");
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS holds_share boolean NOT NULL DEFAULT false/);
    for (const name of ["Vânzător", "Cumpărător", "Succesor universal", "Adjudecatar", "Titular / Proprietar", "Titular al imobilului", "Titular de drept"]) {
      expect(sql).toContain(`'${name}'`);
    }
    for (const prefix of ["Proprietar%", "Coproprietar%", "Moștenitor%"]) expect(sql).toContain(`LIKE '${prefix}'`);
    const update = sql.slice(sql.indexOf("UPDATE lookup_doc_type_person_role"), sql.indexOf("DO $$"));
    expect(update).not.toMatch(/Notar|Proiectant|Topograf|Reprezentant|Solicitant/);
  });
});
