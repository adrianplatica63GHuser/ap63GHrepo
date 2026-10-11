/**
 * @jest-environment node
 */

/**
 * Slice #38.87 — „Interacțiuni": changing and deleting a record.
 *
 * A row chosen loads into the log tile in „Editează selecția"; it saves over the `updatedAt` it read, so a record
 * someone else changed since answers 409 and the tile offers „Reîncarcă" or „Suprascrie" — overwrite never the
 * default (§7); switching row or mode with a dirty form asks first; the delete names the person and the date and
 * says the linked documents stay (§8.8); the audit line names who created and who last changed it (§6).
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
import { PUT } from "@/app/api/interactions/[id]/route";
import { checkForm, fromRecord, isDirty, switchMove } from "@/lib/interactions/form";
import type { InteractionRecord } from "@/lib/interactions/model";

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
const q = queries as unknown as Record<string, jest.Mock>;
const ID = "44444444-4444-4444-8444-444444444444";
const PERSON = "33333333-3333-4333-8333-333333333333";
const DOC = "55555555-5555-4555-8555-555555555555";
const PROP = "77777777-7777-4777-8777-777777777777";

const RECORD: InteractionRecord = {
  id: ID,
  channel: "PHONE",
  direction: "INBOUND",
  occurredAt: new Date(2026, 9, 9, 9, 15).toISOString(),
  personId: PERSON,
  personName: "Ana Popa",
  personType: "NATURAL",
  subject: "Apel de clarificare",
  status: "NEEDS_REPLY",
  followUpOn: "2026-10-16",
  documentCount: 1,
  updatedAt: "2026-10-10T08:00:00.000Z",
  description: "A cerut extrasul.",
  internalNote: "Clientul grăbit.",
  relatedPropertyId: PROP,
  relatedPropertyLabel: "Livada",
  documentIds: [DOC],
  documents: [{ id: DOC, title: "Extras CF" }],
  tags: ["Urgent"],
  createdAt: "2026-10-09T09:20:00.000Z",
  createdBy: "adrian@example.test",
  createdByName: "adrian",
  updatedBy: "ciprian@example.test",
  updatedByName: "ciprian",
};

beforeEach(() => Object.values(q).forEach((m) => (typeof m === "function" ? m.mockReset() : undefined)));

describe("a record in „Editează selecția”", () => {
  it("shows every field it holds, and saves back exactly what it read", () => {
    const f = fromRecord(RECORD);
    expect(f).toMatchObject({ channel: "PHONE", direction: "INBOUND", status: "NEEDS_REPLY", when: "2026-10-09T09:15", personId: PERSON, followUp: true, internal: true });
    const r = checkForm(f, new Date(2026, 9, 10, 12, 0));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.input).toMatchObject({
      occurredAt: RECORD.occurredAt,
      subject: RECORD.subject,
      description: RECORD.description,
      internalNote: RECORD.internalNote,
      followUpOn: RECORD.followUpOn,
      documentIds: [DOC],
      tags: ["Urgent"],
      relatedPropertyId: PROP,
    });
  });

  it("is clean as loaded, dirty once anything changes", () => {
    const f = fromRecord(RECORD);
    expect(isDirty(fromRecord(RECORD), f)).toBe(false);
    expect(isDirty({ ...f, subject: "Altceva" }, f)).toBe(true);
  });
});

describe("the mode switch and the selection (§2)", () => {
  it("a clean form switches at once; a dirty one asks; the same record is no move at all", () => {
    expect(switchMove(false, null, ID)).toBe("switch");
    expect(switchMove(true, null, ID)).toBe("ask");
    expect(switchMove(true, ID, null)).toBe("ask");
    expect(switchMove(false, ID, null)).toBe("switch");
    expect(switchMove(true, ID, ID)).toBe("stay");
  });

  it("the screen asks through it, and the log tile answers in the tile", () => {
    const screen = read("src", "app", "interactions", "_components", "interactions-screen.tsx");
    expect(screen.match(/switchMove\(dirtyRef\.current,/g)).toHaveLength(2);
    const tile = read("src", "app", "interactions", "_components", "log-tile.tsx");
    expect(tile).toContain("useUnsavedChangesGuard({ isDirty: dirty, onSave: () => save(false) })");
  });
});

describe("a stale save (§7) — overwrite is never the default", () => {
  it("the change is sent over the updatedAt it read, and only „Suprascrie” sends the newer one", () => {
    const tile = read("src", "app", "interactions", "_components", "log-tile.tsx");
    expect(tile).toContain("expectedUpdatedAt: over ?? readAt");
    // The version saved over is the one the form was filled from — never a newer copy read in the background.
    expect(tile).not.toMatch(/expectedUpdatedAt: [^,}]*loaded/);
    expect(tile.match(/save\(false, over\)/g)).toHaveLength(1);
    const block = tile.slice(tile.indexOf("{conflict && ("), tile.indexOf("{/* The action bar"));
    // „Reîncarcă" first and in the primary colour; „Suprascrie" second, secondary.
    expect(block.indexOf('tl("conflictReload")')).toBeLessThan(block.indexOf('tl("conflictOverwrite")'));
    expect(block).toMatch(/onClick=\{reload\} className=\{buttonClass\(\{ variant: "accent"/);
  });

  it("the route answers 409 with what is stored now, and saves over it when asked with its updatedAt", async () => {
    const body = { channel: "PHONE", occurredAt: RECORD.occurredAt, personId: PERSON, subject: "Nou", expectedUpdatedAt: "2026-10-10T08:00:00.000Z" };
    q.updateInteraction.mockResolvedValueOnce("conflict");
    q.getInteraction.mockResolvedValueOnce({ ...RECORD, updatedAt: "2026-10-10T09:00:00.000Z" });
    const stale = await PUT({ json: async () => body } as never, { params: Promise.resolve({ id: ID }) });
    expect(stale.status).toBe(409);
    expect((await stale.json()).current.updatedAt).toBe("2026-10-10T09:00:00.000Z");

    q.updateInteraction.mockResolvedValueOnce("updated");
    q.getInteraction.mockResolvedValueOnce({ ...RECORD, subject: "Nou" });
    const over = await PUT({ json: async () => ({ ...body, expectedUpdatedAt: "2026-10-10T09:00:00.000Z" }) } as never, { params: Promise.resolve({ id: ID }) });
    expect(over.status).toBe(200);
    expect(q.updateInteraction.mock.calls[1][1].expectedUpdatedAt).toBe("2026-10-10T09:00:00.000Z");
  });
});

describe("the delete (§8.8) and the audit line (§6)", () => {
  const RO = JSON.parse(read("messages", "ro-RO.json")) as { interactions: { log: Record<string, string> } };

  it("the confirmation names the person and the date, and says the linked documents stay", () => {
    expect(RO.interactions.log.deleteBody).toContain("{person}");
    expect(RO.interactions.log.deleteBody).toContain("{date}");
    expect(RO.interactions.log.deleteKeeps).toMatch(/Actele legate rămân în arhivă/);
  });

  it("the audit line names who created it and who last changed it, and when", () => {
    for (const k of ["{createdBy}", "{createdAt}", "{updatedBy}", "{updatedAt}"]) expect(RO.interactions.log.audit).toContain(k);
  });

  it("names are the app's usernames where the e-mail has one, the e-mail otherwise (Ask first #2)", () => {
    const src = read("src", "lib", "interactions", "queries.ts");
    const get = src.slice(src.indexOf("export async function getInteraction"), src.indexOf("function rowValues"));
    expect(get).toMatch(/coalesce\(\(SELECT u\.username FROM app_users u WHERE lower\(u\.email\) = lower\(\$\{interaction\.createdBy\}\)\), \$\{interaction\.createdBy\}\)/);
    expect(get).toMatch(/coalesce\(\(SELECT u\.username FROM app_users u WHERE lower\(u\.email\) = lower\(\$\{interaction\.updatedBy\}\)\), \$\{interaction\.updatedBy\}\)/);
  });
});
