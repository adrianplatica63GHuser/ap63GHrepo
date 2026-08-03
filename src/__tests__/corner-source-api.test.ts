/**
 * @jest-environment node
 */

/**
 * GET / POST /api/documents/[id]/corner-source        (Slice #23.06.Import)
 *
 * The HTTP boundary of the coordinate-document → Property link. The DB layer
 * and the query helpers are mocked; what is under test is the contract the
 * import wizard depends on:
 *
 *   • a first claim succeeds with 201
 *   • a SECOND claim on the same document yields 409 — this is the whole slice
 *   • the 409 carries the WINNING property, so the caller can say which one
 *     owns the file instead of just "already used"
 *   • a soft-deleted property cannot be claimed (that would lock a document to
 *     something the user can never open)
 *
 * Mirrors the mocking style of properties-api.test.ts.
 */

const mockSelectResults: unknown[][] = [];

jest.mock("@/db", () => ({
  __esModule: true,
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => mockSelectResults.shift() ?? [],
        }),
      }),
    }),
  },
}));

jest.mock("@/lib/auth/current-user", () => ({
  __esModule: true,
  getCurrentUser: jest.fn().mockResolvedValue({ id: "u1", email: "adrian@example.com" }),
}));

jest.mock("@/lib/properties/corner-source", () => ({
  __esModule: true,
  claimCornerSource:          jest.fn(),
  getCornerSourceForDocument: jest.fn(),
}));

import type { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/documents/[id]/corner-source/route";
import * as cornerSource from "@/lib/properties/corner-source";
import * as auth from "@/lib/auth/current-user";

const mocks = cornerSource as unknown as {
  claimCornerSource:          jest.Mock;
  getCornerSourceForDocument: jest.Mock;
};
const authMocks = auth as unknown as { getCurrentUser: jest.Mock };

const DOC    = "33333333-3333-4333-8333-333333333333";
const PROP_A = "11111111-1111-4111-8111-111111111111";
const PROP_B = "22222222-2222-4222-8222-222222222222";

const LINK_A = {
  propertyId:       PROP_A,
  propertyCode:     "PROP00001",
  propertyNickname: "Lot 1",
  createdAt:        new Date("2026-08-03T00:00:00Z"),
  createdBy:        "adrian@example.com",
};
const LINK_B = { ...LINK_A, propertyId: PROP_B, propertyCode: "PROP00002", propertyNickname: "Lot 2" };

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function postReq(body: unknown): NextRequest {
  return new Request("http://localhost/api/documents/x/corner-source", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  }) as unknown as NextRequest;
}

function getReq(): NextRequest {
  return new Request("http://localhost/api/documents/x/corner-source") as unknown as NextRequest;
}

/** Queue the rows the route's `db.select(...).limit(1)` calls will see. */
function queueRows(...results: unknown[][]) {
  mockSelectResults.length = 0;
  mockSelectResults.push(...results);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSelectResults.length = 0;
  authMocks.getCurrentUser.mockResolvedValue({ id: "u1", email: "adrian@example.com" });
});

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

describe("GET /api/documents/[id]/corner-source", () => {
  it("returns link: null for a document that has produced no property", async () => {
    queueRows([{ id: DOC }]);
    mocks.getCornerSourceForDocument.mockResolvedValue(null);

    const res = await GET(getReq(), ctx(DOC));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ link: null });
  });

  it("returns the link for a document that has", async () => {
    queueRows([{ id: DOC }]);
    mocks.getCornerSourceForDocument.mockResolvedValue(LINK_A);

    const res = await GET(getReq(), ctx(DOC));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { link: { propertyId: string } };
    expect(body.link.propertyId).toBe(PROP_A);
  });

  it("404s for a missing or soft-deleted document", async () => {
    queueRows([]);
    const res = await GET(getReq(), ctx(DOC));
    expect(res.status).toBe(404);
  });

  it("401s with no session", async () => {
    authMocks.getCurrentUser.mockResolvedValue(null);
    const res = await GET(getReq(), ctx(DOC));
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST — the lock
// ---------------------------------------------------------------------------

describe("POST /api/documents/[id]/corner-source", () => {
  it("claims a free document with 201", async () => {
    queueRows([{ id: DOC }], [{ id: PROP_A }]);
    mocks.claimCornerSource.mockResolvedValue(true);
    mocks.getCornerSourceForDocument.mockResolvedValue(LINK_A);

    const res = await POST(postReq({ propertyId: PROP_A }), ctx(DOC));
    expect(res.status).toBe(201);
    expect(mocks.claimCornerSource).toHaveBeenCalledWith(DOC, PROP_A, "adrian@example.com");
  });

  it("yields 409 on a SECOND claim, and names the winner", async () => {
    // The heart of the slice. Before it, the second path through — the Process
    // panel, after the wizard had already built the Property — sailed past a
    // provenance check that could not see what the wizard had done, and made a
    // duplicate Property with identical coordinates.
    queueRows([{ id: DOC }], [{ id: PROP_B }]);
    mocks.claimCornerSource.mockResolvedValue(false);
    mocks.getCornerSourceForDocument.mockResolvedValue(LINK_A);

    const res = await POST(postReq({ propertyId: PROP_B }), ctx(DOC));
    expect(res.status).toBe(409);

    const body = (await res.json()) as { link: { propertyId: string; propertyCode: string } };
    expect(body.link.propertyId).toBe(PROP_A);
    expect(body.link.propertyCode).toBe("PROP00001");
  });

  it("still returns the existing link when the second claim is for the SAME property", async () => {
    // The server does not decide whether this is an error — it reports who
    // holds the link and lets the caller judge. corner-source-client reads it
    // as `already-ours`, which is what makes claim-then-write retry-safe.
    queueRows([{ id: DOC }], [{ id: PROP_A }]);
    mocks.claimCornerSource.mockResolvedValue(false);
    mocks.getCornerSourceForDocument.mockResolvedValue(LINK_A);

    const res = await POST(postReq({ propertyId: PROP_A }), ctx(DOC));
    expect(res.status).toBe(409);
    const body = (await res.json()) as { link: { propertyId: string } };
    expect(body.link.propertyId).toBe(PROP_A);
  });

  it("404s when the property is missing or soft-deleted, without claiming", async () => {
    // A soft-deleted property must never be claimable: the document would be
    // locked to something the user cannot open, and only SQL would free it.
    queueRows([{ id: DOC }], []);

    const res = await POST(postReq({ propertyId: PROP_A }), ctx(DOC));
    expect(res.status).toBe(404);
    expect(mocks.claimCornerSource).not.toHaveBeenCalled();
  });

  it("404s when the document is missing, without claiming", async () => {
    queueRows([], [{ id: PROP_A }]);
    const res = await POST(postReq({ propertyId: PROP_A }), ctx(DOC));
    expect(res.status).toBe(404);
    expect(mocks.claimCornerSource).not.toHaveBeenCalled();
  });

  it("400s on a missing or non-uuid propertyId", async () => {
    for (const body of [{}, { propertyId: "" }, { propertyId: "not-a-uuid" }, { propertyId: 7 }]) {
      const res = await POST(postReq(body), ctx(DOC));
      expect(res.status).toBe(400);
    }
    expect(mocks.claimCornerSource).not.toHaveBeenCalled();
  });

  it("401s with no session, without claiming", async () => {
    authMocks.getCurrentUser.mockResolvedValue(null);
    const res = await POST(postReq({ propertyId: PROP_A }), ctx(DOC));
    expect(res.status).toBe(401);
    expect(mocks.claimCornerSource).not.toHaveBeenCalled();
  });

  it("records a null author under UAT_NO_AUTH rather than inventing one", async () => {
    // #21.11.uat.auth: the synthetic identity has a stable id for rate-limit
    // bucketing but deliberately no email, so audit columns record no author
    // instead of a fake one. #21.02 settled that an opaque uuid in an audit
    // column was never useful.
    authMocks.getCurrentUser.mockResolvedValue({ id: "uat-no-auth", email: null });
    queueRows([{ id: DOC }], [{ id: PROP_A }]);
    mocks.claimCornerSource.mockResolvedValue(true);
    mocks.getCornerSourceForDocument.mockResolvedValue(LINK_A);

    await POST(postReq({ propertyId: PROP_A }), ctx(DOC));
    expect(mocks.claimCornerSource).toHaveBeenCalledWith(DOC, PROP_A, null);
  });
});
