/**
 * @jest-environment node
 */

/**
 * „Adaugă nou" cannot create a second property for a parcel that has one.
 *                                                    (Slice #37.04, FU-016)
 *
 * THE DEFECT
 * ──────────
 * `POST /api/properties` — what the Property form's „Salvează" sends on
 * „Adaugă nou" — called a bare `createProperty`, so a tarla and parcelă that
 * already belonged to a property got a SECOND property, silently. The import
 * had the answer since #26.07: `ensurePropertyForFolder` takes an advisory
 * lock on the parcel's identity and looks under it before it writes. This
 * route now goes through the same lock and the same lookup
 * (`createPropertyUnlessParcelExists`, beside it in import-property.ts), and
 * a match answers 409 with the property found — nothing is written.
 *
 * The database is mocked at `@/db` and `@/lib/properties/queries`; what is
 * asserted is the route's decision, not SQL.
 *
 * RED ON THE CODE BEFORE THIS SLICE: committed on its own, ahead of the fix;
 * the runner's jest run on that commit is quoted in the fix commit's body.
 */

const mockTx = {
  execute: jest.fn().mockResolvedValue(undefined),
  select: jest.fn(() => ({
    from: () => ({ where: () => ({ limit: async () => [{ indicativ: "40" }] }) }),
  })),
};

jest.mock("@/db", () => ({
  __esModule: true,
  db: { transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(mockTx)) },
}));

jest.mock("@/lib/supabase/server", () => ({
  __esModule: true,
  createServerClient: jest.fn().mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
  }),
}));

jest.mock("@/lib/metadata/queries", () => ({
  __esModule: true,
  setInitialProvenance: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/properties/queries", () => ({
  __esModule: true,
  listProperties: jest.fn(),
  createProperty: jest.fn(),
  createPropertyIn: jest.fn(),
  findPropertiesByCadastralIdentity: jest.fn(),
  updatePropertyIn: jest.fn(),
}));

import type { NextRequest } from "next/server";
import { POST } from "@/app/api/properties/route";
import * as queries from "@/lib/properties/queries";

const mocks = queries as unknown as {
  createProperty: jest.Mock;
  createPropertyIn: jest.Mock;
  findPropertiesByCadastralIdentity: jest.Mock;
};

const TARLA_ID = "c0ffee00-0000-4000-8000-000000000040";

const existing = {
  id: "prop-existing",
  code: "PROP00042",
  nickname: "Teren existent",
  principalObjectId: "po-42",
  tarla: "40",
  parcela: "212",
  cornerCount: 4,
};

const created = {
  property: { id: "prop-new", code: "PROP00043", principalObjectId: "po-43", tarlaId: TARLA_ID, parcela: "213" },
  address: null,
  corners: [],
};

function post(body: unknown): Promise<Response> {
  return POST(
    new Request("http://localhost/api/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as unknown as NextRequest,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mocks.createProperty.mockResolvedValue(created);
  mocks.createPropertyIn.mockResolvedValue(created);
});

describe("POST /api/properties with a tarla and a parcelă (FU-016)", () => {
  it("answers 409 with the existing property, and creates nothing, when the parcel already has one", async () => {
    mocks.findPropertiesByCadastralIdentity.mockResolvedValue([existing]);

    const res = await post({ nickname: "Al doilea", tarlaId: TARLA_ID, parcela: "212" });

    expect(res.status).toBe(409);
    const body = (await res.json()) as { code?: string; matches?: { id: string; code: string }[] };
    expect(body.code).toBe("PARCEL_EXISTS");
    expect(body.matches?.map((m) => m.code)).toEqual(["PROP00042"]);
    expect(mocks.createProperty).not.toHaveBeenCalled();
    expect(mocks.createPropertyIn).not.toHaveBeenCalled();
  });

  it("looks under the parcel's advisory lock, the import's, before it writes", async () => {
    mocks.findPropertiesByCadastralIdentity.mockResolvedValue([]);

    const res = await post({ nickname: "Primul", tarlaId: TARLA_ID, parcela: "213" });

    expect(res.status).toBe(201);
    expect(mockTx.execute).toHaveBeenCalledTimes(1); // pg_advisory_xact_lock, before the lookup
    expect(mocks.findPropertiesByCadastralIdentity).toHaveBeenCalledWith(mockTx, "40", "213");
    expect(mocks.createPropertyIn).toHaveBeenCalledTimes(1);
    expect(mocks.createProperty).not.toHaveBeenCalled();
  });

  it("a create with no parcelă has no identity to look for, and is written as before", async () => {
    const res = await post({ nickname: "Fără parcelă", tarlaId: TARLA_ID });

    expect(res.status).toBe(201);
    expect(mocks.findPropertiesByCadastralIdentity).not.toHaveBeenCalled();
  });
});
