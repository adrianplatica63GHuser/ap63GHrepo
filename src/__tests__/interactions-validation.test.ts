/**
 * @jest-environment node
 */

/**
 * Slice #38.83 — „Interacțiuni": the log's storage and routes.
 *
 * The rules of the spec's form (§4) and validation (§7): required fields, a subject of at most 120 characters, a
 * future date only when SCHEDULED, an unknown channel or status refused. Description and internal note are never a
 * filter, a sort or a search (§8.2). A change that read an older row answers 409 (§7). migration_105 holds the CHECKs.
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
}));

import { readFileSync } from "fs";
import { join } from "path";
import { FILTER_FIELDS, SEARCH_FIELDS, SORT_FIELDS, SUBJECT_MAX } from "@/lib/interactions/model";
import { checkWhen, interactionInputSchema, interactionListQuerySchema, interactionUpdateSchema } from "@/lib/interactions/validation";
import * as queries from "@/lib/interactions/queries";
import { GET as LIST, POST } from "@/app/api/interactions/route";
import { DELETE, PUT } from "@/app/api/interactions/[id]/route";

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
const q = queries as unknown as Record<string, jest.Mock>;
const PERSON = "33333333-3333-4333-8333-333333333333";
const ID = "44444444-4444-4444-8444-444444444444";
const VALID = { channel: "PHONE", occurredAt: "2026-10-09T10:30:00+03:00", personId: PERSON, subject: "Discuție despre contract" };
const NOW = new Date("2026-10-10T12:00:00Z");

beforeEach(() => Object.values(q).forEach((m) => (typeof m === "function" ? m.mockReset() : undefined)));

describe("an interaction's fields (§4)", () => {
  it("needs a channel, a date, a person and a subject; defaults direction OUTBOUND and status LOGGED", () => {
    const ok = interactionInputSchema.parse(VALID);
    expect(ok).toMatchObject({ direction: "OUTBOUND", status: "LOGGED", description: null, internalNote: null, documentIds: [], tags: [] });
    for (const k of ["channel", "occurredAt", "personId", "subject"] as const) {
      const body: Record<string, unknown> = { ...VALID };
      delete body[k];
      expect([k, interactionInputSchema.safeParse(body).success]).toEqual([k, false]);
    }
  });

  it("refuses a blank subject and one longer than 120 characters; keeps one of exactly 120, trimmed", () => {
    expect(SUBJECT_MAX).toBe(120);
    expect(interactionInputSchema.safeParse({ ...VALID, subject: "   " }).success).toBe(false);
    expect(interactionInputSchema.safeParse({ ...VALID, subject: "x".repeat(121) }).success).toBe(false);
    expect(interactionInputSchema.parse({ ...VALID, subject: ` ${"x".repeat(120)} ` }).subject).toHaveLength(120);
  });

  it("refuses an unknown channel, direction or status, and a field it does not know", () => {
    expect(interactionInputSchema.safeParse({ ...VALID, channel: "FAX" }).success).toBe(false);
    expect(interactionInputSchema.safeParse({ ...VALID, direction: "SIDEWAYS" }).success).toBe(false);
    expect(interactionInputSchema.safeParse({ ...VALID, status: "ARCHIVED" }).success).toBe(false);
    expect(interactionInputSchema.safeParse({ ...VALID, gmailMessageId: "x" }).success).toBe(false);
  });

  it("keeps description and internal note apart; empty text is stored as nothing", () => {
    const v = interactionInputSchema.parse({ ...VALID, description: "Ce s-a convenit", internalNote: "Clientul nemulțumit" });
    expect([v.description, v.internalNote]).toEqual(["Ce s-a convenit", "Clientul nemulțumit"]);
    expect(interactionInputSchema.parse({ ...VALID, description: "  " }).description).toBeNull();
  });

  it("links documents and tags each once", () => {
    const v = interactionInputSchema.parse({ ...VALID, documentIds: [ID, ID], tags: [" urgent ", "urgent", "client"] });
    expect(v.documentIds).toEqual([ID]);
    expect(v.tags).toEqual(["urgent", "client"]);
  });
});

describe("a date in the future is for a scheduled item only (§7)", () => {
  it("past or now: any status", () => {
    expect(checkWhen({ occurredAt: "2026-10-01T09:00:00Z", status: "LOGGED" }, NOW)).toBeNull();
    expect(checkWhen({ occurredAt: "2026-10-10T12:00:30Z", status: "LOGGED" }, NOW)).toBeNull(); // the minute's grace
  });
  it("future: only SCHEDULED", () => {
    expect(checkWhen({ occurredAt: "2026-10-12T09:00:00Z", status: "SENT" }, NOW)).toBe("future_not_scheduled");
    expect(checkWhen({ occurredAt: "2026-10-12T09:00:00Z", status: "SCHEDULED" }, NOW)).toBeNull();
  });
  it("the route refuses it", async () => {
    const res = await POST({ json: async () => ({ ...VALID, occurredAt: "2099-01-01T09:00:00Z" }) } as never);
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("future_not_scheduled");
    expect(q.createInteraction).not.toHaveBeenCalled();
  });
});

describe("description and internal note are never a filter, a sort or a search (§8.2)", () => {
  it("are not among the filter, sort or search fields", () => {
    for (const list of [FILTER_FIELDS, SORT_FIELDS, SEARCH_FIELDS] as readonly (readonly string[])[]) {
      for (const banned of ["description", "internalNote", "internal_note"]) expect(list).not.toContain(banned);
    }
  });

  it("the list's query refuses them as a parameter, and as a sort", () => {
    for (const p of [{ description: "x" }, { internalNote: "x" }, { sort: "description" }, { sort: "internalNote" }]) {
      expect([p, interactionListQuerySchema.safeParse(p).success]).toEqual([p, false]);
    }
  });

  it("the WHERE builder reads neither", () => {
    const src = read("src", "lib", "interactions", "queries.ts");
    const where = src.slice(src.indexOf("export function listWhere"), src.indexOf("const SORT_COLUMN"));
    expect(where).not.toMatch(/description|internalNote|internal_note/);
    const sorts = src.slice(src.indexOf("const SORT_COLUMN"), src.indexOf("const listColumns"));
    expect(sorts).not.toMatch(/description|internalNote|internal_note/);
  });

  it("the defaults: newest first, a page of 25", () => {
    expect(interactionListQuerySchema.parse({})).toMatchObject({ sort: "occurredAt", order: "desc", limit: 25, offset: 0 });
    expect(interactionListQuerySchema.parse({ channels: "EMAIL,PHONE", statuses: "NEEDS_REPLY", hasDocuments: "true" })).toMatchObject({
      channels: ["EMAIL", "PHONE"],
      statuses: ["NEEDS_REPLY"],
      hasDocuments: true,
    });
    expect(interactionListQuerySchema.safeParse({ channels: "EMAIL,FAX" }).success).toBe(false);
  });

  it("the list route answers 400 on such a parameter, and never queries", async () => {
    const res = await LIST({ url: "http://x/api/interactions?description=contract" } as never);
    expect(res.status).toBe(400);
    expect(q.listInteractions).not.toHaveBeenCalled();
  });
});

describe("two people editing one record (§7)", () => {
  const put = (body: unknown) => PUT({ json: async () => body } as never, { params: Promise.resolve({ id: ID }) });

  it("a change needs the updatedAt it read", () => {
    expect(interactionUpdateSchema.safeParse(VALID).success).toBe(false);
    expect(interactionUpdateSchema.safeParse({ ...VALID, expectedUpdatedAt: "2026-10-10T08:00:00.000Z" }).success).toBe(true);
  });

  it("a row changed since answers 409 and is not overwritten", async () => {
    q.updateInteraction.mockResolvedValueOnce("conflict");
    q.getInteraction.mockResolvedValueOnce({ id: ID, updatedAt: "2026-10-10T09:00:00.000Z" });
    const res = await put({ ...VALID, expectedUpdatedAt: "2026-10-10T08:00:00.000Z" });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: "stale_interaction", current: { updatedAt: "2026-10-10T09:00:00.000Z" } });
  });

  it("the queries compare updated_at in the UPDATE itself", () => {
    const src = read("src", "lib", "interactions", "queries.ts");
    expect(src).toContain(".where(and(eq(interaction.id, id), eq(interaction.updatedAt, new Date(input.expectedUpdatedAt))))");
  });

  it("an unknown id is 404 on change and on delete", async () => {
    q.updateInteraction.mockResolvedValueOnce("not_found");
    expect((await put({ ...VALID, expectedUpdatedAt: "2026-10-10T08:00:00.000Z" })).status).toBe(404);
    q.deleteInteraction.mockResolvedValueOnce(false);
    expect((await DELETE({} as never, { params: Promise.resolve({ id: ID }) })).status).toBe(404);
  });
});

describe("migration_105 (Slice #38.83)", () => {
  const SQL = read("src", "db", "migration_105_interactions.sql");
  it("holds the CHECKs the schema declares", () => {
    expect(SQL).toContain("CHECK (channel IN ('EMAIL', 'WHATSAPP', 'SMS', 'PHONE', 'MEETING', 'PAPER_MAIL'))");
    expect(SQL).toContain("CHECK (direction IN ('INBOUND', 'OUTBOUND'))");
    expect(SQL).toContain("CHECK (char_length(btrim(subject)) BETWEEN 1 AND 120)");
    expect(SQL).toContain("CHECK (status IN ('LOGGED', 'NEEDS_REPLY', 'SENT', 'COMPLETED', 'SCHEDULED'))");
  });
  it("cascades a person's interactions with the person (Ask first #1), sets a gone property to nothing (#4)", () => {
    expect(SQL).toContain("person_id           uuid        NOT NULL REFERENCES person (id) ON DELETE CASCADE");
    expect(SQL).toContain("related_property_id uuid        REFERENCES property (id) ON DELETE SET NULL");
  });
  it("links documents and tags each once, and stores no file and no message id", () => {
    expect(SQL).toContain("CONSTRAINT interaction_document_unique UNIQUE (interaction_id, document_id)");
    expect(SQL).toContain("CONSTRAINT interaction_tag_unique UNIQUE (interaction_id, tag)");
    // The statements only — the header says „NO GMAIL, NO WHATSAPP" in words.
    const statements = SQL.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
    expect(statements).not.toMatch(/message_id|gmail|whatsapp_id|file_path|storage_key/i);
  });
});
