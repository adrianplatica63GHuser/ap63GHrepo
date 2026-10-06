/**
 * @jest-environment node
 *
 * FU-018 — the form editor's save is refused when the form changed meanwhile.
 *                                                          (Slice #37.05)
 *
 * Reference Data → Formular saves through the value-lists PUT, a FULL replace
 * of `template_fields`. Its concurrency check was client-side only: the editor
 * compared the key list it opened with against the list row's CACHED copy,
 * which is the same stale copy — so a field added meanwhile by an AI-Discovery
 * review or another tab was silently deleted by the save. The other door into
 * the column, `PUT /api/document-types/[id]/template-fields`, has always taken
 * `knownKeys` and answered 409 `template_changed` (its route, „Optimistic
 * concurrency"). The value-lists PUT now does the same, and the editor sends
 * the keys it opened with and shows the 409 in its own words.
 *
 * Red on the code before the fix: the update schema dropped `knownKeys`, and
 * nothing answered 409.
 */
jest.mock("@/lib/auth/current-role", () => ({ requireFullAccess: jest.fn(async () => null) }));

const mockUpdateValue = jest.fn();
jest.mock("@/lib/admin/value-lists/queries", () => ({
  updateValue: (...a: unknown[]) => mockUpdateValue(...a),
  deleteValue: jest.fn(),
}));

import type { NextRequest } from "next/server";
import { PUT } from "@/app/api/admin/value-lists/[list]/[id]/route";
import { documentTypeUpdateSchema } from "@/lib/admin/value-lists/validation";
import * as editorRows from "@/lib/documents/template-editor-rows";

const ID = "00000000-0000-4000-8000-000000000002";
const FIELD = { key: "nr", labelRo: "Nr.", labelEn: "No.", type: "text", order: 0 };

function put(body: unknown): Promise<Response> {
  const req = new Request(`http://localhost/api/admin/value-lists/document-types/${ID}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return PUT(req as unknown as NextRequest, { params: Promise.resolve({ list: "document-types", id: ID }) });
}

describe("FU-018: the update schema carries the keys the editor opened with", () => {
  it("keeps knownKeys beside templateFields", () => {
    const parsed = documentTypeUpdateSchema.parse({ name: "T", templateFields: [FIELD], knownKeys: ["a", "b"] });
    expect(parsed).toHaveProperty("knownKeys", ["a", "b"]);
  });

  it("refuses a form written without knownKeys — a full replace that cannot say what it replaces", () => {
    expect(documentTypeUpdateSchema.safeParse({ name: "T", templateFields: [FIELD] }).success).toBe(false);
    expect(documentTypeUpdateSchema.safeParse({ name: "T", templateFields: null }).success).toBe(false);
  });

  it("still takes a rename that does not touch the form, with no knownKeys", () => {
    expect(documentTypeUpdateSchema.safeParse({ name: "T" }).success).toBe(true);
  });
});

describe("FU-018: the PUT answers 409 template_changed, as the other door does", () => {
  beforeEach(() => mockUpdateValue.mockReset());

  it("passes knownKeys to updateValue", async () => {
    mockUpdateValue.mockResolvedValue({ id: ID, name: "T" });
    const res = await put({ name: "T", templateFields: [FIELD], knownKeys: [] });
    expect(res.status).toBe(200);
    expect(mockUpdateValue.mock.calls[0][2]).toHaveProperty("knownKeys", []);
  });

  it("maps a changed form to 409 with the stored fields, so the screen can say so", async () => {
    // Required here, not imported at the top: on the code before the fix the
    // module does not exist, and only THIS test should be red for it.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { TemplateChangedError } = require("@/lib/documents/template-concurrency");
    const stored = [{ ...FIELD, key: "added" }];
    mockUpdateValue.mockRejectedValue(new TemplateChangedError(stored));
    const res = await put({ name: "T", templateFields: [FIELD], knownKeys: [] });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("template_changed");
    expect(body.fields).toEqual(stored);
  });
});

describe("FU-018: the editor sends the keys it opened with", () => {
  it("builds the PUT body with name, templateFields and knownKeys", () => {
    const build = (editorRows as Record<string, unknown>).documentTypeFormPutBody as
      | ((name: string, fields: unknown[], knownKeys: readonly string[]) => unknown)
      | undefined;
    expect(typeof build).toBe("function");
    expect(build?.("T", [FIELD], ["x"])).toEqual({ name: "T", templateFields: [FIELD], knownKeys: ["x"] });
  });
});

describe("FU-018: after a 409 the editor can be reopened on the stored form", () => {
  it("refetches the list the dialog reopens from, in the 409 branch itself", () => {
    // Driven on 2026-09-27: without it, „close and reopen" — what the message
    // tells the administrator to do — reopened the editor on the same cached
    // form, and every Save met the same 409. Read as code, comments stripped.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("node:fs") as typeof import("node:fs");
    const src = fs.readFileSync(
      `${process.cwd()}/src/app/admin/value-lists/_components/document-type-form-editor.tsx`,
      "utf8",
    );
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    const at = code.indexOf("code === TEMPLATE_CHANGED_CODE");
    expect(at).toBeGreaterThan(-1);
    const branch = code.slice(at, code.indexOf("throw new Error", at));
    expect(branch).toContain('qc.invalidateQueries({ queryKey: ["value-list", "document-types"] });');
  });
});
