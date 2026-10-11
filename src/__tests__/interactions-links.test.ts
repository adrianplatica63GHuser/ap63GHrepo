/**
 * @jest-environment node
 */

/**
 * Slice #38.86 — „Interacțiuni": linked documents, tags and a related property.
 *
 * A record links documents that are already in the archive — a link, never a copy (§6) — takes tags, suggested from
 * the tags used most recently on interactions (§4), and one optional property. The links and the tags go through
 * the routes and come back; a document is never linked twice; deleting a document removes its link and leaves the
 * interaction.
 */
jest.mock("@/lib/supabase/server", () => ({ createAdminClient: jest.fn(), createServerClient: jest.fn() }));
jest.mock("@/lib/auth/current-user", () => ({ getCurrentUserEmail: jest.fn(async () => "adrian@example.test") }));
jest.mock("@/lib/interactions/queries", () => ({
  __esModule: true,
  listInteractions: jest.fn(),
  getInteraction: jest.fn(),
  createInteraction: jest.fn(),
  updateInteraction: jest.fn(),
  deleteInteraction: jest.fn(),
  interactionTagSuggestions: jest.fn(),
}));

import { readFileSync } from "fs";
import { join } from "path";
import * as queries from "@/lib/interactions/queries";
import { POST } from "@/app/api/interactions/route";
import { GET as GET_ONE } from "@/app/api/interactions/[id]/route";
import { GET as TAGS } from "@/app/api/interactions/tags/route";
import { checkForm, emptyForm, isDirty, withDocument, withTag } from "@/lib/interactions/form";

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
const q = queries as unknown as Record<string, jest.Mock>;
const PERSON = "33333333-3333-4333-8333-333333333333";
const ID = "44444444-4444-4444-8444-444444444444";
const DOC_A = "55555555-5555-4555-8555-555555555555";
const DOC_B = "66666666-6666-4666-8666-666666666666";
const PROP = "77777777-7777-4777-8777-777777777777";
const NOW = new Date(2026, 9, 10, 14, 0);

beforeEach(() => Object.values(q).forEach((m) => (typeof m === "function" ? m.mockReset() : undefined)));

describe("the links and the tags go through the routes and come back", () => {
  it("the form sends the documents' ids, the tags and the property's id — never a name, never a file", () => {
    const f = {
      ...emptyForm(PERSON),
      subject: "Contract de vânzare",
      documents: [
        { id: DOC_A, title: "Contract v3" },
        { id: DOC_B, title: "Extras CF" },
      ],
      tags: ["Contract", "Urgent"],
      property: { id: PROP, label: "Livada" },
    };
    const r = checkForm(f, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.input).toMatchObject({ documentIds: [DOC_A, DOC_B], tags: ["Contract", "Urgent"], relatedPropertyId: PROP });
    expect(JSON.stringify(r.input)).not.toMatch(/Contract v3|Extras CF|Livada/);
  });

  it("POST hands them to the query, and answers the record read back with the documents named", async () => {
    q.createInteraction.mockResolvedValueOnce(ID);
    const record = { id: ID, documentIds: [DOC_A, DOC_B], documents: [{ id: DOC_A, title: "Contract v3" }, { id: DOC_B, title: "Extras CF" }], tags: ["Contract", "Urgent"], relatedPropertyId: PROP };
    q.getInteraction.mockResolvedValueOnce(record);
    const body = {
      channel: "EMAIL",
      occurredAt: "2026-10-09T10:30:00+03:00",
      personId: PERSON,
      subject: "Contract de vânzare",
      documentIds: [DOC_A, DOC_B, DOC_A],
      tags: [" Contract ", "Urgent", "Contract"],
      relatedPropertyId: PROP,
    };
    const res = await POST({ json: async () => body } as never);
    expect(res.status).toBe(201);
    const input = q.createInteraction.mock.calls[0][0];
    expect(input).toMatchObject({ documentIds: [DOC_A, DOC_B], tags: ["Contract", "Urgent"], relatedPropertyId: PROP });
    expect(await res.json()).toEqual(record);
  });

  it("GET of one record answers its documents with their names, its tags and its property", async () => {
    q.getInteraction.mockResolvedValueOnce({ id: ID, documents: [{ id: DOC_A, title: "Contract v3" }], tags: ["Urgent"], relatedPropertyId: PROP });
    const res = await GET_ONE({} as never, { params: Promise.resolve({ id: ID }) });
    expect(await res.json()).toMatchObject({ documents: [{ id: DOC_A, title: "Contract v3" }], tags: ["Urgent"], relatedPropertyId: PROP });
  });

  it("the read joins each link to its document for the name the archive gives it", () => {
    const src = read("src", "lib", "interactions", "queries.ts");
    const get = src.slice(src.indexOf("export async function getInteraction"), src.indexOf("function rowValues"));
    expect(get).toContain(".innerJoin(document, eq(document.id, interactionDocument.documentId))");
    expect(get).toContain("title: document.title");
  });
});

describe("a document is never linked twice", () => {
  it("the form adds a document once", () => {
    const one = withDocument([], { id: DOC_A, title: "A" });
    expect(withDocument(one, { id: DOC_A, title: "A" })).toEqual(one);
    expect(withDocument(one, { id: DOC_B, title: "B" })).toHaveLength(2);
  });

  it("the route keeps one of each, and the table refuses the pair twice", () => {
    const sql = read("src", "db", "migration_105_interactions.sql");
    expect(sql).toContain("CONSTRAINT interaction_document_unique UNIQUE (interaction_id, document_id)");
  });
});

describe("deleting a document removes its link and leaves the interaction", () => {
  it("the link cascades with the document; the interaction holds no reference to a document of its own", () => {
    const sql = read("src", "db", "migration_105_interactions.sql");
    expect(sql).toContain("document_id    uuid        NOT NULL REFERENCES document (id)    ON DELETE CASCADE");
    const interaction = sql.slice(sql.indexOf("CREATE TABLE IF NOT EXISTS interaction ("), sql.indexOf("CREATE INDEX IF NOT EXISTS interaction_occurred_at_idx"));
    expect(interaction).not.toMatch(/REFERENCES document/);
  });
});

describe("tags (§4)", () => {
  it("a tag is added trimmed, once whatever its case, never empty, never over 60 characters", () => {
    expect(withTag([], "  Contract  ")).toEqual(["Contract"]);
    expect(withTag(["Contract"], "contract")).toEqual(["Contract"]);
    expect(withTag(["Contract"], "   ")).toEqual(["Contract"]);
    expect(withTag([], "x".repeat(61))).toEqual([]);
    expect(withTag(["Contract"], "Urgent")).toEqual(["Contract", "Urgent"]);
  });

  it("the suggestions come from interactions' own tags, the most recently used first", () => {
    const src = read("src", "lib", "interactions", "queries.ts");
    const fn = src.slice(src.indexOf("export async function interactionTagSuggestions"));
    expect(fn).toContain(".from(interactionTag)");
    expect(fn).toMatch(/orderBy\(desc\(sql`max\(\$\{interactionTag\.createdAt\}\)`\)/);
    expect(fn).not.toMatch(/entity_tag|entityTag/);
  });

  it("the route answers them, with or without a prefix, and refuses any other parameter", async () => {
    q.interactionTagSuggestions.mockResolvedValueOnce(["Contract", "Urgent"]);
    const res = await TAGS({ url: "http://x/api/interactions/tags?prefix=Co" } as never);
    expect(await res.json()).toEqual({ tags: ["Contract", "Urgent"] });
    expect(q.interactionTagSuggestions).toHaveBeenCalledWith("Co");
    q.interactionTagSuggestions.mockResolvedValueOnce([]);
    await TAGS({ url: "http://x/api/interactions/tags" } as never);
    expect(q.interactionTagSuggestions).toHaveBeenLastCalledWith(undefined);
    expect((await TAGS({ url: "http://x/api/interactions/tags?entity=1" } as never)).status).toBe(400);
  });
});

describe("the form's links make it dirty, and a link taken back makes it clean again", () => {
  it("compares what is linked, not which array holds it", () => {
    const base = emptyForm(PERSON);
    const linked = { ...base, documents: withDocument(base.documents, { id: DOC_A, title: "A" }) };
    expect(isDirty(linked, base)).toBe(true);
    expect(isDirty({ ...linked, documents: [] }, base)).toBe(false);
    expect(isDirty({ ...base, property: { id: PROP, label: "L" } }, base)).toBe(true);
  });
});
