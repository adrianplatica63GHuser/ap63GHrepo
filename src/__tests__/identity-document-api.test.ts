/**
 * @jest-environment node
 */

/**
 * The document API's identity block.                                    (Slice 40.82)
 *
 * GET /api/documents/[id] returns `identity` (null on an ordinary type); POST and PATCH accept one, written in the
 * same transaction as the document; a write the identity rules refuse is a 400 carrying its named `code` and the
 * `fields` it names. The query layer is mocked here: what is pinned is the route's contract — the block in the
 * answer, the refusal's shape, and a block that names a field the table does not have never reaching the query
 * layer at all. The rules themselves are identity-document-validation.test.ts.
 */
jest.mock("@/db", () => ({ __esModule: true, db: {} }));
jest.mock("@/lib/auth/current-user", () => ({
  __esModule: true,
  getCurrentUserEmail: jest.fn().mockResolvedValue("test@example.invalid"),
}));
jest.mock("@/lib/documents/queries", () => ({
  __esModule: true,
  getDocumentById: jest.fn(),
  deleteDocument: jest.fn(),
  updateDocument: jest.fn(),
  createDocument: jest.fn(),
  listDocument: jest.fn(),
}));
jest.mock("@/lib/identity-documents/queries", () => {
  const actual = jest.requireActual("@/lib/identity-documents/queries") as typeof import("@/lib/identity-documents/queries");
  return { __esModule: true, ...actual, identityBlockFor: jest.fn() };
});

import type { NextRequest } from "next/server";
import { GET, PATCH } from "@/app/api/documents/[id]/route";
import { POST } from "@/app/api/documents/route";
import * as documentQ from "@/lib/documents/queries";
import * as identityQ from "@/lib/identity-documents/queries";
import { IdentityWriteRefusedError } from "@/lib/identity-documents/queries";
import { emptyIdentityValues } from "@/lib/identity-documents/validation";

const DOC_ID = "1b4e28ba-2fa1-41d2-883f-0016d3cca427";
const TYPE_ID = "6ec0bd7f-11c0-43da-975e-2a8ad9ebae0b";
const ctx = { params: Promise.resolve({ id: DOC_ID }) };
const req = (body: unknown) =>
  new Request("http://localhost/api/documents", { method: "POST", body: JSON.stringify(body) }) as unknown as NextRequest;

const mocked = <T extends (...args: never[]) => unknown>(fn: T) => fn as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GET returns the identity block", () => {
  it("the kind, the values and the warnings on an identity document", async () => {
    mocked(documentQ.getDocumentById).mockResolvedValue({ id: DOC_ID, documentTypeId: TYPE_ID, code: "DOC00001" });
    const block = { kind: "CI_NOU", values: { ...emptyIdentityValues(), lastName: "Popescu" }, warnings: [] };
    mocked(identityQ.identityBlockFor).mockResolvedValue(block);
    const res = await GET({} as NextRequest, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.code).toBe("DOC00001");
    expect(body.identity).toEqual(block);
    expect(mocked(identityQ.identityBlockFor).mock.calls[0].slice(1)).toEqual([DOC_ID, TYPE_ID]);
  });

  it("null on an ordinary type", async () => {
    mocked(documentQ.getDocumentById).mockResolvedValue({ id: DOC_ID, documentTypeId: TYPE_ID });
    mocked(identityQ.identityBlockFor).mockResolvedValue(null);
    const body = await (await GET({} as NextRequest, ctx)).json();
    expect(body.identity).toBeNull();
  });
});

describe("PATCH", () => {
  it("passes the identity block to the update, and answers with the block as stored", async () => {
    mocked(documentQ.updateDocument).mockResolvedValue({ id: DOC_ID, documentTypeId: TYPE_ID, version: 2, identityRemoved: [] });
    mocked(identityQ.identityBlockFor).mockResolvedValue({ kind: "PASAPORT", values: emptyIdentityValues(), warnings: [] });
    const res = await PATCH(req({ identity: { domicileCounty: "Ilfov" } }), ctx);
    expect(res.status).toBe(200);
    expect(mocked(documentQ.updateDocument).mock.calls[0][1]).toEqual({ identity: { domicileCounty: "Ilfov" } });
    expect((await res.json()).identity.kind).toBe("PASAPORT");
  });

  it("a refusal is a 400 with its code and the fields it names", async () => {
    mocked(documentQ.updateDocument).mockRejectedValue(new IdentityWriteRefusedError("identity_field_not_in_kind", ["cnp", "mrz"]));
    const res = await PATCH(req({ identity: { cnp: "1850421400123" } }), ctx);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "identity_field_not_in_kind", code: "identity_field_not_in_kind", fields: ["cnp", "mrz"] });
  });

  it("a block naming a field the table does not have never reaches the query layer", async () => {
    const res = await PATCH(req({ identity: { nrDocument: "RT 123456" } }), ctx);
    expect(res.status).toBe(400);
    expect(mocked(documentQ.updateDocument)).not.toHaveBeenCalled();
  });

  it("refuses moving a document holding identity values to an ordinary type, by name", async () => {
    mocked(documentQ.updateDocument).mockRejectedValue(new IdentityWriteRefusedError("identity_values_held", []));
    const res = await PATCH(req({ documentTypeId: TYPE_ID }), ctx);
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("identity_values_held");
  });
});

describe("POST", () => {
  it("creates with the block in the same call, and answers with it", async () => {
    mocked(documentQ.createDocument).mockResolvedValue({ id: DOC_ID, documentTypeId: TYPE_ID, principalObjectId: "x" });
    mocked(identityQ.identityBlockFor).mockResolvedValue({ kind: "CI_VECHE", values: emptyIdentityValues(), warnings: [] });
    const res = await POST(req({ documentTypeId: TYPE_ID, identity: { civilStatus: "căsătorit" } }));
    expect(res.status).toBe(201);
    expect(mocked(documentQ.createDocument).mock.calls[0][0].identity).toEqual({ civilStatus: "căsătorit" });
    expect((await res.json()).identity.kind).toBe("CI_VECHE");
  });

  it("a block on an ordinary type is refused, 400, by name", async () => {
    mocked(documentQ.createDocument).mockRejectedValue(new IdentityWriteRefusedError("identity_on_ordinary_type", ["lastName"]));
    const res = await POST(req({ documentTypeId: TYPE_ID, identity: { lastName: "Popescu" } }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("identity_on_ordinary_type");
  });
});
