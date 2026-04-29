/**
 * @jest-environment node
 */

/**
 * Tests for the /api/people and /api/people/[id] route handlers.
 *
 * The DB layer (`@/lib/persons/queries`) is mocked so these tests stay in
 * the regular `npm test` lane without needing a live Postgres. The point
 * of this suite is the HTTP boundary: query parsing, body validation,
 * error mapping, and response shape — not the SQL behind it.
 *
 * Pure schema/mapping behaviour stays in natural-person.test.ts.
 */

// --- Mock the DB queries module before importing the routes ----------------
//
// Each handler imports from "@/lib/persons/queries"; mocking the module
// here means those imports resolve to our jest mocks at test time.
jest.mock("@/lib/persons/queries", () => ({
  __esModule: true,
  listPersons: jest.fn(),
  createNaturalPerson: jest.fn(),
  getPersonById: jest.fn(),
  updateNaturalPerson: jest.fn(),
  softDeletePerson: jest.fn(),
}));

import type { NextRequest } from "next/server";
import {
  GET as listGet,
  POST as listPost,
} from "@/app/api/people/route";
import {
  GET as oneGet,
  PATCH as onePatch,
  DELETE as oneDelete,
} from "@/app/api/people/[id]/route";
import * as queries from "@/lib/persons/queries";

const mocks = queries as unknown as {
  listPersons: jest.Mock;
  createNaturalPerson: jest.Mock;
  getPersonById: jest.Mock;
  updateNaturalPerson: jest.Mock;
  softDeletePerson: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function req(url: string, init?: RequestInit): NextRequest {
  // The route handlers only touch fields available on the standard Request
  // (.url, .json()), so passing a plain Request is fine here.
  return new Request(url, init) as unknown as NextRequest;
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

// ---------------------------------------------------------------------------
// GET /api/people
// ---------------------------------------------------------------------------

describe("GET /api/people", () => {
  it("returns items and applies default pagination on a valid query", async () => {
    mocks.listPersons.mockResolvedValueOnce({
      items: [
        {
          id: "p1",
          code: "PERS00001",
          type: "NATURAL",
          displayName: "Adrian P.",
          email: null,
          phone: null,
        },
      ],
      total: 1,
    });

    const res = await listGet(req("http://localhost/api/people?q=adrian"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({
      items: expect.any(Array),
      total: 1,
      limit: 50,
      offset: 0,
    });
    expect(mocks.listPersons).toHaveBeenCalledWith({
      q: "adrian",
      limit: 50,
      offset: 0,
    });
  });

  it("rejects a limit above 200 with a 400", async () => {
    const res = await listGet(req("http://localhost/api/people?limit=999"));
    expect(res.status).toBe(400);
    expect(mocks.listPersons).not.toHaveBeenCalled();
  });

  it("rejects a negative offset with a 400", async () => {
    const res = await listGet(req("http://localhost/api/people?offset=-1"));
    expect(res.status).toBe(400);
    expect(mocks.listPersons).not.toHaveBeenCalled();
  });

  it("returns 500 when the DB query throws", async () => {
    mocks.listPersons.mockRejectedValueOnce(new Error("boom"));
    // Silence the expected console.error from unexpectedError().
    const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      const res = await listGet(req("http://localhost/api/people"));
      expect(res.status).toBe(500);
    } finally {
      errSpy.mockRestore();
    }
  });
});

// ---------------------------------------------------------------------------
// POST /api/people
// ---------------------------------------------------------------------------

describe("POST /api/people", () => {
  it("rejects malformed JSON with a 400", async () => {
    const res = await listPost(
      req("http://localhost/api/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{ not json",
      }),
    );
    expect(res.status).toBe(400);
    expect(mocks.createNaturalPerson).not.toHaveBeenCalled();
  });

  it("rejects a payload that fails Zod validation", async () => {
    // Empty body: missing both a name and a contact method.
    const res = await listPost(
      req("http://localhost/api/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
    expect(mocks.createNaturalPerson).not.toHaveBeenCalled();
  });

  it("returns 201 with the created record on success", async () => {
    mocks.createNaturalPerson.mockResolvedValueOnce({
      person: {
        id: "p1",
        code: "PERS00001",
        type: "NATURAL",
        displayName: "Adrian",
      },
      natural: { personId: "p1", firstName: "Adrian" },
      addresses: [],
    });

    const res = await listPost(
      req("http://localhost/api/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: "Adrian",
          personalEmail1: "adrian@example.ro",
        }),
      }),
    );

    expect(res.status).toBe(201);
    expect(mocks.createNaturalPerson).toHaveBeenCalledTimes(1);

    const body = await res.json();
    expect(body.person.id).toBe("p1");
  });

  it("translates a CNP unique-violation into a 409", async () => {
    mocks.createNaturalPerson.mockRejectedValueOnce(
      Object.assign(new Error("duplicate key"), {
        code: "23505",
        constraint: "natural_person_cnp_unique",
      }),
    );

    const res = await listPost(
      req("http://localhost/api/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: "Adrian",
          personalEmail1: "adrian@example.ro",
          cnp: "1234567890123",
        }),
      }),
    );
    expect(res.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// GET /api/people/[id]
// ---------------------------------------------------------------------------

describe("GET /api/people/[id]", () => {
  it("returns 404 when the person isn't found (or is soft-deleted)", async () => {
    mocks.getPersonById.mockResolvedValueOnce(null);
    const res = await oneGet(
      req("http://localhost/api/people/abc"),
      ctx("abc"),
    );
    expect(res.status).toBe(404);
  });

  it("returns the full record when found", async () => {
    mocks.getPersonById.mockResolvedValueOnce({
      person: { id: "abc", code: "PERS00001", displayName: "X" },
      natural: null,
      addresses: [],
    });
    const res = await oneGet(
      req("http://localhost/api/people/abc"),
      ctx("abc"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.person.id).toBe("abc");
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/people/[id]
// ---------------------------------------------------------------------------

describe("PATCH /api/people/[id]", () => {
  it("rejects malformed JSON with a 400", async () => {
    const res = await onePatch(
      req("http://localhost/api/people/abc", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      }),
      ctx("abc"),
    );
    expect(res.status).toBe(400);
    expect(mocks.updateNaturalPerson).not.toHaveBeenCalled();
  });

  it("returns 404 when the underlying query reports no row updated", async () => {
    mocks.updateNaturalPerson.mockResolvedValueOnce(null);
    const res = await onePatch(
      req("http://localhost/api/people/abc", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: "X" }),
      }),
      ctx("abc"),
    );
    expect(res.status).toBe(404);
  });

  it("returns 200 with the updated record on success", async () => {
    mocks.updateNaturalPerson.mockResolvedValueOnce({
      person: { id: "abc", code: "PERS00001", displayName: "X" },
      natural: { personId: "abc", firstName: "X" },
      addresses: [],
    });
    const res = await onePatch(
      req("http://localhost/api/people/abc", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: "X" }),
      }),
      ctx("abc"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.person.id).toBe("abc");
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/people/[id]
// ---------------------------------------------------------------------------

describe("DELETE /api/people/[id]", () => {
  it("returns 404 when there's nothing to soft-delete", async () => {
    mocks.softDeletePerson.mockResolvedValueOnce(false);
    const res = await oneDelete(
      req("http://localhost/api/people/abc", { method: "DELETE" }),
      ctx("abc"),
    );
    expect(res.status).toBe(404);
  });

  it("returns 204 with no body on success", async () => {
    mocks.softDeletePerson.mockResolvedValueOnce(true);
    const res = await oneDelete(
      req("http://localhost/api/people/abc", { method: "DELETE" }),
      ctx("abc"),
    );
    expect(res.status).toBe(204);
    // 204 = no body; .text() should be empty.
    expect(await res.text()).toBe("");
  });
});
