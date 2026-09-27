/**
 * FU-022 — a re-read replaces the AI's leftover-text block.     (Slice #37.06)
 *
 * The automatic read folds whatever the model could not map into „Note" as one
 * block headed „[AI] Text neasociat unui câmp:". A re-read (the refill walk, a
 * retried row) APPENDED the new block after the old one, so the notes carried
 * two readings of the same pages, the older one superseded and still there.
 * The new block now takes the old one's place; everything a person wrote, and
 * the printed-heading line, stays.
 */
import { runAiInterpret } from "@/lib/import/ai-interpret-run";

type Call = { url: string; method: string; body: unknown };
const REAL_FETCH = (globalThis as { fetch?: unknown }).fetch;

function install(answers: { ok?: boolean; body?: unknown }[]): Call[] {
  const calls: Call[] = [];
  let i = 0;
  (globalThis as unknown as { fetch: unknown }).fetch = jest.fn(async (url: string, init?: RequestInit) => {
    const answer = answers[i++] ?? { ok: true, body: {} };
    calls.push({ url, method: init?.method ?? "GET", body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined });
    return {
      ok: answer.ok ?? true,
      redirected: false,
      status: 200,
      headers: { get: (n: string) => (n.toLowerCase() === "content-type" ? "application/json" : null) },
      json: async () => answer.body ?? {},
    };
  });
  return calls;
}

afterEach(() => {
  (globalThis as unknown as { fetch: unknown }).fetch = REAL_FETCH;
});

const STAMP = "2026-09-27T10:00:00.000Z";
const OLD = "[AI] Text neasociat unui câmp:\nBirou notarial: vechi\nSuprafață: 100 mp";
const NEW = "[AI] Text neasociat unui câmp:\nBirou notarial: nou";

function extract(notes: string | null) {
  return { ok: true, body: { fields: {}, customFields: {}, notes } };
}
function current(notes: string | null) {
  return { ok: true, body: { notes, documentTypeId: "type-uuid", customFields: {} } };
}
const notesOf = (calls: Call[]) => (calls[2]?.body as { notes?: string } | undefined)?.notes;

describe("FU-022: a re-read's block replaces the earlier one", () => {
  it("replaces the old block and keeps what a person wrote, in place", async () => {
    const calls = install([extract(NEW), current(`Notă scrisă de om\n\n${OLD}\n\nAltă notă`), { ok: true }]);
    await runAiInterpret("doc-1", STAMP);
    expect(notesOf(calls)).toBe(`Notă scrisă de om\n\nAltă notă\n\n${NEW}`);
  });

  it("replaces a block that is the whole of the notes", async () => {
    const calls = install([extract(NEW), current(OLD), { ok: true }]);
    await runAiInterpret("doc-1", STAMP);
    expect(notesOf(calls)).toBe(NEW);
  });

  it("writes nothing when the re-read's block is the one already there", async () => {
    const calls = install([extract(NEW), current(`Notă scrisă de om\n\n${NEW}`), { ok: true }]);
    await runAiInterpret("doc-1", STAMP);
    expect(notesOf(calls)).toBeUndefined();
  });

  it("keeps the old block when the re-read has none to put in its place", async () => {
    const calls = install([extract(null), current(`Notă scrisă de om\n\n${OLD}`), { ok: true }]);
    await runAiInterpret("doc-1", STAMP);
    expect(notesOf(calls)).toBeUndefined();
  });
});
