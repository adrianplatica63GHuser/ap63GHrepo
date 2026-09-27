/**
 * @jest-environment node
 *
 * FU-020 — the server decides a document type's origin.    (Slice #37.05)
 *
 * `lookup_document_type.origin` says who chose a type's name: IMPORT when a
 * machine did (the classifier's resolver, in-process), MANUAL when a person
 * did. Until this slice the Reference Data POST read it off the request body —
 * `documentTypeSchema` carried `origin` as a create-only field and
 * `createValue` passed the body straight to `createDocumentTypeRow`, the one
 * list it did not strip — so any client could claim a type was AI-scanned.
 * `lookup_tarla.origin` never had that hole: the tarla seed decides it at the
 * write site, and the POST cannot name it. Now neither can this one.
 *
 * Red on the code before the fix: the schema kept `origin`, and the route
 * handed it to `createValue`.
 */
import fs from "node:fs";
import path from "node:path";

jest.mock("@/lib/auth/current-role", () => ({ requireSuperuser: jest.fn(async () => null) }));

const mockCreateValue = jest.fn(async (_list: string, data: Record<string, unknown>) => ({
  id: "00000000-0000-4000-8000-000000000001",
  ...data,
}));
jest.mock("@/lib/admin/value-lists/queries", () => ({
  createValue: (list: string, data: Record<string, unknown>) => mockCreateValue(list, data),
  listValues: jest.fn(),
  PREFERRED_KEY_TAKEN: "preferred-key-taken",
}));

import type { NextRequest } from "next/server";
import { POST } from "@/app/api/admin/value-lists/[list]/route";
import { documentTypeSchema } from "@/lib/admin/value-lists/validation";

function post(body: unknown): Promise<Response> {
  const req = new Request("http://localhost/api/admin/value-lists/document-types", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return POST(req as unknown as NextRequest, { params: Promise.resolve({ list: "document-types" }) });
}

describe("FU-020: a request cannot state a document type's origin", () => {
  beforeEach(() => mockCreateValue.mockClear());

  it("drops an origin a client puts in the create payload", () => {
    expect(documentTypeSchema.parse({ name: "Contract", origin: "IMPORT" })).not.toHaveProperty("origin");
    expect(documentTypeSchema.parse({ name: "Contract", origin: "MANUAL" })).not.toHaveProperty("origin");
  });

  it("never hands createValue an origin from the body of „Adaugă”", async () => {
    const res = await post({ name: "Contract nou", origin: "IMPORT" });
    expect(res.status).toBe(201);
    expect(mockCreateValue).toHaveBeenCalledTimes(1);
    expect(mockCreateValue.mock.calls[0][0]).toBe("document-types");
    expect(mockCreateValue.mock.calls[0][1]).not.toHaveProperty("origin");
  });

  it("strips origin in createValue for every list, document-types included", () => {
    // The second layer, for a caller that reaches createValue without the
    // route's schema. Read as code, comments stripped, so a comment cannot
    // satisfy it.
    const src = fs.readFileSync(path.join(process.cwd(), "src/lib/admin/value-lists/queries.ts"), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    const body = code.slice(code.indexOf("export async function createValue("));
    const head = body.slice(0, body.indexOf("switch (key)"));
    expect(head.replace(/\s+/g, "")).toContain("constdata:any=stripLookupOrigin(payload);");
  });
});
