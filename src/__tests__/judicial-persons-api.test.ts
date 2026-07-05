/**
 * @jest-environment node
 */

/**
 * Tests for the /api/judicial-persons and /api/judicial-persons/[id] routes.
 *
 * DB layer is mocked so these tests run without a live Postgres.
 * Focus: HTTP boundary — query parsing, body validation, error mapping,
 * and response shape.
 */

// Mock Supabase server client so routes that call createServerClient()
// for the updatedBy user email don't throw "cookies outside request scope".
jest.mock("@/lib/supabase/server", () => ({
  __esModule: true,
  createServerClient: jest.fn().mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
  }),
}));

jest.mock("@/lib/judicial-persons/queries", () => ({
  __esModule: true,
  listJudicialPersons: jest.fn(),
  createJudicialPerson: jest.fn(),
  getJudicialPersonById: jest.fn(),
  updateJudicialPerson: jest.fn(),
}));

// softDeletePerson lives in the natural-person module and is reused by the
// judicial DELETE handler — mock it there too.
jest.mock("@/lib/persons/queries", () => ({
  __esModule: true,
  softDeletePerson: jest.fn(),
  listPersons: jest.fn(),
  createNaturalPerson: jest.fn(),
  getPersonById: jest.fn(),
  updateNaturalPerson: jest.fn(),
}));

import type { NextRequest } from "next/server";
import {
  GET as listGet,
  POST as listPost,
} from "@/app/api/judicial-persons/route";
import {
  GET as oneGet,
  PATCH as onePatch,
  DELETE as oneDelete,
} from "@/app/api/judicial-persons/[id]/route";
import * as judicialQueries from "@/lib/judicial-persons/queries";
import * as personQueries from "@/lib/persons/queries";

const jMocks = judicialQueries as unknown as {
  listJudicialPersons: jest.Mock;
  createJudicialPerson: jest.Mock;
  getJudicialPersonById: jest.Mock;
  updateJudicialPerson: jest.Mock;
};

const pMocks = personQueries as unknown as {
  softDeletePerson: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
});

function req(url: string, init?: RequestInit): NextRequest {
  return new Request(url, init) as unknown as NextRequest;
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

// ---------------------------------------------------------------------------
// GET /api/judicial-persons
// ---------------------------------------------------------------------------

describe("GET /api/judicial-persons", () => {
  it("returns items and applies default pagination", async () => {
    jMocks.listJudicialPersons.mockResolvedValueOnce({
      items: [
        {
          id: "j1",
          code: "JPERS00002",
          displayName: "SC Exemplu SRL",
          nickname: null,
          cuiNumber: "RO12345678",
        },
      ],
      total: 1,
    });

    const res = await listGet(req("http://localhost/api/judicial-persons?q=exemplu"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({
      items: expect.any(Array),
      total: 1,
      limit: 50,
      offset: 0,
    });
    expect(jMocks.listJudicialPersons).toHaveBeenCalledWith({
      q: "exemplu",
      limit: 50,
      offset: 0,
    });
  });

  it("rejects a limit above 200 with a 400", async () => {
    const res = await listGet(req("http://localhost/api/judicial-persons?limit=999"));
    expect(res.status).toBe(400);
    expect(jMocks.listJudicialPersons).not.toHaveBeenCalled();
  });

  it("rejects a negative offset with a 400", async () => {
    const res = await listGet(req("http://localhost/api/judicial-persons?offset=-1"));
    expect(res.status).toBe(400);
    expect(jMocks.listJudicialPersons).not.toHaveBeenCalled();
  });

  it("returns 500 when the DB query throws", async () => {
    jMocks.listJudicialPersons.mockRejectedValueOnce(new Error("boom"));
    const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      const res = await listGet(req("http://localhost/api/judicial-persons"));
      expect(res.status).toBe(500);
    } finally {
      errSpy.mockRestore();
    }
  });
});

// ---------------------------------------------------------------------------
// POST /api/judicial-persons
// ---------------------------------------------------------------------------

describe("POST /api/judicial-persons", () => {
  it("rejects malformed JSON with a 400", async () => {
    const res = await listPost(
      req("http://localhost/api/judicial-persons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{ not json",
      }),
    );
    expect(res.status).toBe(400);
    expect(jMocks.createJudicialPerson).not.toHaveBeenCalled();
  });

  it("rejects a payload without name with a 400", async () => {
    const res = await listPost(
      req("http://localhost/api/judicial-persons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: "test" }),
      }),
    );
    expect(res.status).toBe(400);
    expect(jMocks.createJudicialPerson).not.toHaveBeenCalled();
  });

  it("returns 201 with the created record on success", async () => {
    jMocks.createJudicialPerson.mockResolvedValueOnce({
      person: { id: "j1", code: "JPERS00002", type: "JUDICIAL", displayName: "SC Test SRL" },
      judicial: { personId: "j1", name: "SC Test SRL" },
      addresses: [],
    });

    const res = await listPost(
      req("http://localhost/api/judicial-persons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "SC Test SRL" }),
      }),
    );

    expect(res.status).toBe(201);
    expect(jMocks.createJudicialPerson).toHaveBeenCalledTimes(1);

    const body = await res.json();
    expect(body.person.id).toBe("j1");
  });

  it("translates a CUI unique-violation into a 409", async () => {
    jMocks.createJudicialPerson.mockRejectedValueOnce(
      Object.assign(new Error("duplicate key"), {
        code: "23505",
        constraint: "judicial_person_cui_unique",
      }),
    );

    const res = await listPost(
      req("http://localhost/api/judicial-persons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "SC Test SRL", cuiNumber: "RO12345678" }),
      }),
    );
    expect(res.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// GET /api/judicial-persons/[id]
// ---------------------------------------------------------------------------

describe("GET /api/judicial-persons/[id]", () => {
  it("returns 404 when the person is not found", async () => {
    jMocks.getJudicialPersonById.mockResolvedValueOnce(null);
    const res = await oneGet(
      req("http://localhost/api/judicial-persons/abc"),
      ctx("abc"),
    );
    expect(res.status).toBe(404);
  });

  it("returns the full record when found", async () => {
    jMocks.getJudicialPersonById.mockResolvedValueOnce({
      person: { id: "abc", code: "JPERS00002", displayName: "SC Test SRL" },
      judicial: { personId: "abc", name: "SC Test SRL" },
      addresses: [],
    });
    const res = await oneGet(
      req("http://localhost/api/judicial-persons/abc"),
      ctx("abc"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.person.id).toBe("abc");
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/judicial-persons/[id]
// ---------------------------------------------------------------------------

describe("PATCH /api/judicial-persons/[id]", () => {
  it("rejects malformed JSON with a 400", async () => {
    const res = await onePatch(
      req("http://localhost/api/judicial-persons/abc", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      }),
      ctx("abc"),
    );
    expect(res.status).toBe(400);
    expect(jMocks.updateJudicialPerson).not.toHaveBeenCalled();
  });

  it("returns 404 when the underlying query reports no row updated", async () => {
    jMocks.updateJudicialPerson.mockResolvedValueOnce(null);
    const res = await onePatch(
      req("http://localhost/api/judicial-persons/abc", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: "Updated" }),
      }),
      ctx("abc"),
    );
    expect(res.status).toBe(404);
  });

  it("returns 200 with the updated record on success", async () => {
    jMocks.updateJudicialPerson.mockResolvedValueOnce({
      person: { id: "abc", code: "JPERS00002", displayName: "SC Test SRL" },
      judicial: { personId: "abc", name: "SC Test SRL", nickname: "Updated" },
      addresses: [],
    });
    const res = await onePatch(
      req("http://localhost/api/judicial-persons/abc", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: "Updated" }),
      }),
      ctx("abc"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.person.id).toBe("abc");
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/judicial-persons/[id]
// ---------------------------------------------------------------------------

describe("DELETE /api/judicial-persons/[id]", () => {
  it("returns 404 when there is nothing to soft-delete", async () => {
    pMocks.softDeletePerson.mockResolvedValueOnce(false);
    const res = await oneDelete(
      req("http://localhost/api/judicial-persons/abc", { method: "DELETE" }),
      ctx("abc"),
    );
    expect(res.status).toBe(404);
  });

  it("returns 204 with no body on success", async () => {
    pMocks.softDeletePerson.mockResolvedValueOnce(true);
    const res = await oneDelete(
      req("http://localhost/api/judicial-persons/abc", { method: "DELETE" }),
      ctx("abc"),
    );
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
  });
});
