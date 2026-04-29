/**
 * @jest-environment node
 */

/**
 * Tests for the /api/properties and /api/properties/[id] route handlers.
 *
 * The DB layer is mocked — no live Postgres needed.
 * Tests cover the HTTP boundary: query parsing, body validation,
 * error mapping, and response shape.
 */

jest.mock("@/lib/properties/queries", () => ({
  __esModule: true,
  listProperties:      jest.fn(),
  createProperty:      jest.fn(),
  getPropertyById:     jest.fn(),
  updateProperty:      jest.fn(),
  softDeleteProperty:  jest.fn(),
}));

import type { NextRequest } from "next/server";
import {
  GET  as listGet,
  POST as listPost,
} from "@/app/api/properties/route";
import {
  GET    as oneGet,
  PATCH  as onePatch,
  DELETE as oneDelete,
} from "@/app/api/properties/[id]/route";
import * as queries from "@/lib/properties/queries";

const mocks = queries as unknown as {
  listProperties:     jest.Mock;
  createProperty:     jest.Mock;
  getPropertyById:    jest.Mock;
  updateProperty:     jest.Mock;
  softDeleteProperty: jest.Mock;
};

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function req(url: string, init?: RequestInit): NextRequest {
  return new Request(url, init) as unknown as NextRequest;
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

const stubFull = {
  property: {
    id: "prop-1", code: "PROP00001", type: "LAND",
    nickname: "Lot 1", tarlaSola: "T7", parcela: "P145",
    cadastralNumber: "12345", carteFunciara: "CF001",
    useCategory: "CATEG1", surfaceAreaMp: "450.00",
    notes: null, createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
  },
  address: null,
  corners: [
    { id: "c1", propertyId: "prop-1", sequenceNo: 1, lat: 44.3754, lon: 25.9823, createdAt: new Date(), updatedAt: new Date() },
    { id: "c2", propertyId: "prop-1", sequenceNo: 2, lat: 44.3762, lon: 25.9840, createdAt: new Date(), updatedAt: new Date() },
  ],
};

// ---------------------------------------------------------------------------
// GET /api/properties
// ---------------------------------------------------------------------------

describe("GET /api/properties", () => {
  it("returns items with default pagination", async () => {
    mocks.listProperties.mockResolvedValueOnce({ items: [stubFull.property], total: 1 });

    const res = await listGet(req("http://localhost/api/properties"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toMatchObject({ total: 1, limit: 50, offset: 0 });
    expect(mocks.listProperties).toHaveBeenCalledWith({ limit: 50, offset: 0 });
  });

  it("forwards the search query to listProperties", async () => {
    mocks.listProperties.mockResolvedValueOnce({ items: [], total: 0 });
    await listGet(req("http://localhost/api/properties?q=bragadiru&limit=10"));
    expect(mocks.listProperties).toHaveBeenCalledWith({ q: "bragadiru", limit: 10, offset: 0 });
  });

  it("rejects limit above 200 with 400", async () => {
    const res = await listGet(req("http://localhost/api/properties?limit=999"));
    expect(res.status).toBe(400);
    expect(mocks.listProperties).not.toHaveBeenCalled();
  });

  it("returns 500 when the DB throws", async () => {
    mocks.listProperties.mockRejectedValueOnce(new Error("db boom"));
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      const res = await listGet(req("http://localhost/api/properties"));
      expect(res.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });
});

// ---------------------------------------------------------------------------
// POST /api/properties
// ---------------------------------------------------------------------------

describe("POST /api/properties", () => {
  it("returns 201 with the created record on success", async () => {
    mocks.createProperty.mockResolvedValueOnce(stubFull);

    const res = await listPost(
      req("http://localhost/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: "Lot 1" }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.property.id).toBe("prop-1");
    expect(mocks.createProperty).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed JSON with 400", async () => {
    const res = await listPost(
      req("http://localhost/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{ bad json",
      }),
    );
    expect(res.status).toBe(400);
    expect(mocks.createProperty).not.toHaveBeenCalled();
  });

  it("rejects a corner with invalid lat with 400", async () => {
    const res = await listPost(
      req("http://localhost/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ corners: [{ lat: 999, lon: 25.98 }] }),
      }),
    );
    expect(res.status).toBe(400);
    expect(mocks.createProperty).not.toHaveBeenCalled();
  });

  it("rejects an invalid useCategory with 400", async () => {
    const res = await listPost(
      req("http://localhost/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ useCategory: "WRONG" }),
      }),
    );
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /api/properties/[id]
// ---------------------------------------------------------------------------

describe("GET /api/properties/[id]", () => {
  it("returns 404 when not found", async () => {
    mocks.getPropertyById.mockResolvedValueOnce(null);
    const res = await oneGet(req("http://localhost/api/properties/x"), ctx("x"));
    expect(res.status).toBe(404);
  });

  it("returns 200 with the full record when found", async () => {
    mocks.getPropertyById.mockResolvedValueOnce(stubFull);
    const res = await oneGet(req("http://localhost/api/properties/prop-1"), ctx("prop-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.property.id).toBe("prop-1");
    expect(body.corners).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/properties/[id]
// ---------------------------------------------------------------------------

describe("PATCH /api/properties/[id]", () => {
  it("returns 404 when the property doesn't exist", async () => {
    mocks.updateProperty.mockResolvedValueOnce(null);
    const res = await onePatch(
      req("http://localhost/api/properties/x", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: "Updated" }),
      }),
      ctx("x"),
    );
    expect(res.status).toBe(404);
  });

  it("returns 200 with the updated record", async () => {
    mocks.updateProperty.mockResolvedValueOnce({
      ...stubFull,
      property: { ...stubFull.property, nickname: "Updated" },
    });
    const res = await onePatch(
      req("http://localhost/api/properties/prop-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: "Updated" }),
      }),
      ctx("prop-1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.property.nickname).toBe("Updated");
  });

  it("rejects malformed JSON with 400", async () => {
    const res = await onePatch(
      req("http://localhost/api/properties/prop-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      }),
      ctx("prop-1"),
    );
    expect(res.status).toBe(400);
    expect(mocks.updateProperty).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/properties/[id]
// ---------------------------------------------------------------------------

describe("DELETE /api/properties/[id]", () => {
  it("returns 404 when nothing to soft-delete", async () => {
    mocks.softDeleteProperty.mockResolvedValueOnce(false);
    const res = await oneDelete(
      req("http://localhost/api/properties/x", { method: "DELETE" }),
      ctx("x"),
    );
    expect(res.status).toBe(404);
  });

  it("returns 204 with no body on success", async () => {
    mocks.softDeleteProperty.mockResolvedValueOnce(true);
    const res = await oneDelete(
      req("http://localhost/api/properties/prop-1", { method: "DELETE" }),
      ctx("prop-1"),
    );
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
  });
});
