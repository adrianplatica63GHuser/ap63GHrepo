/**
 * @jest-environment node
 */

/**
 * No save overwrites a version it did not see.                 (Slice #37.21)
 *
 * TODAY THE LAST SAVE SILENTLY WINS. Two windows on one record, or two users,
 * and the second „Salvează" overwrote the first with nobody told (FU-014). Every
 * save now says which version it started from (`baseVersion`, the latest version
 * number the form was loaded at), and a save from an older one is refused with a
 * 409 inside the save's own transaction, after a row lock.
 *
 * Per entity — Natural Person, Judicial Person, Property, Document — two things:
 *   1. THE ROUTE. Two saves from the same loaded version: the first is written,
 *      the second is refused with 409 `STALE_VERSION`, and the base version
 *      reaches the update function without reaching the entity's own schema.
 *      The update function is mocked over an in-memory latest version, with the
 *      REAL rule (`checkBaseVersion`) deciding.
 *   2. THE TRANSACTION. The real update function locks the entity's row
 *      (`FOR UPDATE`) and runs `assertBaseVersion` before its first write, so
 *      two racing saves queue on the lock and the second one sees the first.
 *
 * RED FIRST: this file was run before the routes and the update functions were
 * changed; the runner's id is in the handover and in the fix commit.
 */
import fs from "fs";
import path from "path";

jest.mock("@/db", () => ({ __esModule: true, db: {} }));
jest.mock("@/lib/auth/current-user", () => ({
  __esModule: true,
  getCurrentUserEmail: jest.fn().mockResolvedValue("test@example.invalid"),
}));

// An in-memory record per entity: its latest version, moved by every accepted save.
const mockStore = { latest: 3 };
function mockFakeUpdate() {
  return jest.fn(async (_id: string, input: Record<string, unknown>, _by: unknown, baseVersion?: number) => {
    // The REAL rule decides; `import` inside the factory so the mock is hoisted cleanly.
    const { checkBaseVersion } = jest.requireActual("@/lib/versioning/base-version") as typeof import("@/lib/versioning/base-version");
    checkBaseVersion(baseVersion, mockStore.latest);
    mockStore.latest += 1;
    return { input, version: mockStore.latest };
  });
}

jest.mock("@/lib/persons/queries", () => ({
  __esModule: true,
  getPersonById: jest.fn(),
  deletePerson: jest.fn(),
  updateNaturalPerson: mockFakeUpdate(),
}));
jest.mock("@/lib/judicial-persons/queries", () => ({
  __esModule: true,
  getJudicialPersonById: jest.fn(),
  updateJudicialPerson: mockFakeUpdate(),
}));
jest.mock("@/lib/properties/queries", () => ({
  __esModule: true,
  getPropertyById: jest.fn(),
  deleteProperty: jest.fn(),
  updateProperty: mockFakeUpdate(),
}));
jest.mock("@/lib/documents/queries", () => ({
  __esModule: true,
  getDocumentById: jest.fn(),
  deleteDocument: jest.fn(),
  updateDocument: mockFakeUpdate(),
}));

import type { NextRequest } from "next/server";
import { PATCH as patchPerson } from "@/app/api/people/[id]/route";
import { PATCH as patchCompany } from "@/app/api/judicial-persons/[id]/route";
import { PATCH as patchProperty } from "@/app/api/properties/[id]/route";
import { PATCH as patchDocument } from "@/app/api/documents/[id]/route";
import * as personQ from "@/lib/persons/queries";
import * as companyQ from "@/lib/judicial-persons/queries";
import * as propertyQ from "@/lib/properties/queries";
import * as documentQ from "@/lib/documents/queries";
import {
  STALE_VERSION,
  StaleVersionError,
  checkBaseVersion,
  splitBaseVersion,
} from "@/lib/versioning/base-version";

const ROOT = process.cwd();
const read = (...p: string[]): string => fs.readFileSync(path.join(ROOT, ...p), "utf8");

type Patch = (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;

function call(patch: Patch, body: unknown): Promise<Response> {
  return patch(
    new Request("http://localhost/api/x/rec-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as unknown as NextRequest,
    { params: Promise.resolve({ id: "rec-1" }) },
  );
}

describe("the rule", () => {
  it("lets a save through only from the latest version", () => {
    expect(() => checkBaseVersion(3, 3)).not.toThrow();
    expect(() => checkBaseVersion(2, 3)).toThrow(StaleVersionError);
    expect(() => checkBaseVersion(0, null)).toThrow(StaleVersionError);
  });

  it("checks nothing when no base version was sent — every other caller of the routes is unchanged", () => {
    expect(() => checkBaseVersion(undefined, 7)).not.toThrow();
  });

  it("takes the base version out of the body, so the entity's own schema never sees it", () => {
    expect(splitBaseVersion({ baseVersion: 4, nickname: "x" })).toEqual({ ok: true, baseVersion: 4, rest: { nickname: "x" } });
    expect(splitBaseVersion({ nickname: "x" })).toEqual({ ok: true, baseVersion: undefined, rest: { nickname: "x" } });
    expect(splitBaseVersion({ baseVersion: "4" })).toEqual({ ok: false });
    expect(splitBaseVersion({ baseVersion: -1 })).toEqual({ ok: false });
  });
});

const ENTITIES: [string, Patch, jest.Mock, Record<string, unknown>][] = [
  ["the Natural Person", patchPerson as unknown as Patch, (personQ as unknown as { updateNaturalPerson: jest.Mock }).updateNaturalPerson, { nickname: "TC" }],
  ["the Judicial Person", patchCompany as unknown as Patch, (companyQ as unknown as { updateJudicialPerson: jest.Mock }).updateJudicialPerson, { nickname: "TC" }],
  ["the Property", patchProperty as unknown as Patch, (propertyQ as unknown as { updateProperty: jest.Mock }).updateProperty, { nickname: "TC" }],
  ["the Document", patchDocument as unknown as Patch, (documentQ as unknown as { updateDocument: jest.Mock }).updateDocument, { title: "TC" }],
];

describe.each(ENTITIES)("%s's save — the route", (_what, patch, update, body) => {
  beforeEach(() => {
    mockStore.latest = 3;
    update.mockClear();
  });

  it("two saves from the same loaded version: the first is written, the second refused with 409 STALE_VERSION", async () => {
    const first = await call(patch, { ...body, baseVersion: 3 });
    expect(first.status).toBe(200);
    expect(((await first.json()) as { version?: number }).version).toBe(4);

    const second = await call(patch, { ...body, baseVersion: 3 });
    expect(second.status).toBe(409);
    const refusal = (await second.json()) as { code?: string; currentVersion?: number };
    expect(refusal.code).toBe(STALE_VERSION);
    expect(refusal.currentVersion).toBe(4);
    expect(mockStore.latest).toBe(4); // nothing written by the refused save
  });

  it("hands the base version to the update function, and not to the entity's own fields", async () => {
    await call(patch, { ...body, baseVersion: 3 });
    const [id, input, , baseVersion] = update.mock.calls[0] as [string, Record<string, unknown>, unknown, number];
    expect(id).toBe("rec-1");
    expect(baseVersion).toBe(3);
    expect(input).not.toHaveProperty("baseVersion");
  });

  it("refuses a base version that is not a version number, before anything is written", async () => {
    const res = await call(patch, { ...body, baseVersion: "three" });
    expect(res.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });
});

/** The body of an exported async function, from its signature to the next top-level export. */
function fnBody(src: string, name: string): string {
  const i = src.indexOf(`export async function ${name}(`);
  expect([name, i >= 0]).toEqual([name, true]);
  const j = src.indexOf("\nexport ", i + 1);
  return src.slice(i, j < 0 ? undefined : j);
}

const TRANSACTIONS: [string, string[], string, string][] = [
  ["the Natural Person", ["src", "lib", "persons", "queries.ts"], "updateNaturalPerson", "person"],
  ["the Judicial Person", ["src", "lib", "judicial-persons", "queries.ts"], "updateJudicialPerson", "person"],
  ["the Property", ["src", "lib", "properties", "queries.ts"], "updatePropertyIn", "property"],
  ["the Document", ["src", "lib", "documents", "queries.ts"], "updateDocument", "document"],
];

describe.each(TRANSACTIONS)("%s's save — the transaction", (_what, file, fn, kind) => {
  it("locks the row, then checks the base version, before its first write", () => {
    const body = fnBody(read(...file), fn);
    const lock = body.indexOf('.for("update")');
    const check = body.indexOf(`assertBaseVersion(tx, "${kind}", id, baseVersion)`);
    const firstWrite = Math.min(
      ...["tx.update(", "tx.insert(", "tx.delete(", "await tx\n      .update(", "await tx\n        .update("]
        .map((w) => body.indexOf(w))
        .filter((k) => k >= 0),
    );
    expect(lock).toBeGreaterThan(0);
    expect(check).toBeGreaterThan(lock);
    expect(check).toBeLessThan(firstWrite);
  });

  it("answers with the version it wrote, read inside the same transaction", () => {
    expect(fnBody(read(...file), fn)).toMatch(new RegExp(`version: await latestVersionIn\\(tx, "${kind}", id\\)`));
  });
});
