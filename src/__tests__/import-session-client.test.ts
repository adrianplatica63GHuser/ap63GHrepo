/**
 * Unit tests for src/lib/import/session-client.ts   (Slice #29.11)
 *
 * This module has one job and it is a NEGATIVE one, exactly as
 * `preexisting-client.ts` does: whatever goes wrong, the answer must never look
 * like "every document in this report is still in the archive". That sentence
 * is what puts a live "Deschide →" beside every row of a report the user is
 * about to trust, and #29.01's F12 is that screen offering PROP01429 and three
 * DOC codes against a database Adrian had emptied.
 *
 * So every failure shape gets a case, and so do the two invariants the counting
 * rests on: `missing` is derived from what was ASKED rather than from what came
 * back, and `linked` counts the same distinct set `missing` is drawn from.
 */

import { auditSavedSession } from "@/lib/import/session-client";
import type { SavedImportEntry, SavedImportSession } from "@/lib/import/session";

const A = "11111111-2222-4333-8444-555555555555";
const B = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

function entry(over: Partial<SavedImportEntry> = {}): SavedImportEntry {
  return {
    path: over.path ?? "48-50D/act.pdf",
    displayName: over.displayName ?? "act.pdf",
    kind: over.kind ?? "file",
    status: over.status ?? "done",
    ...(over.docId === undefined ? {} : { docId: over.docId }),
  };
}

function session(entries: SavedImportEntry[]): SavedImportSession {
  return { rootFolderName: "Arhiva", savedAt: new Date().toISOString(), entries };
}

type FetchLike = (url: string, init?: unknown) => Promise<unknown>;

/** Install a stub for the duration of one call, and put the real one back. */
async function withFetch<T>(stub: FetchLike, run: () => Promise<T>): Promise<T> {
  const globals = globalThis as unknown as { fetch?: unknown };
  const saved = globals.fetch;
  globals.fetch = stub;
  try {
    return await run();
  } finally {
    globals.fetch = saved;
  }
}

function response(body: unknown, extra: Partial<{ ok: boolean; redirected: boolean }> = {}) {
  return {
    ok: extra.ok ?? true,
    status: extra.ok === false ? 500 : 200,
    redirected: extra.redirected ?? false,
    json: async () => body,
  };
}

describe("auditSavedSession", () => {
  it("reports the ids the archive did not return", async () => {
    const result = await withFetch(
      async () => response({ existing: [A] }),
      () => auditSavedSession(session([entry({ docId: A }), entry({ docId: B })])),
    );
    expect(result).toEqual({ ok: true, missing: new Set([B]), linked: 2 });
  });

  it("⚠️ reads an EMPTY answer as everything gone, not as nothing asked", async () => {
    // This is the whole shape of the question. The route answers the positive —
    // which ids still exist — precisely so that an empty list is a real answer.
    // A module that derived `missing` from the RESPONSE rather than from what it
    // asked would report an emptied database as a report in perfect health.
    const result = await withFetch(
      async () => response({ existing: [] }),
      () => auditSavedSession(session([entry({ docId: A }), entry({ docId: B })])),
    );
    expect(result).toEqual({ ok: true, missing: new Set([A, B]), linked: 2 });
  });

  it("asks the route nothing when no row carries a document id", async () => {
    // An empty question has a known answer, and a route that has to special-case
    // an empty array is a route with an untested branch. `lookupPreexisting`'s
    // rule, kept.
    let called = false;
    const result = await withFetch(
      async () => {
        called = true;
        return response({ existing: [] });
      },
      () => auditSavedSession(session([entry({ status: "error" }), entry({ status: "error" })])),
    );
    expect({ called, result }).toEqual({
      called: false,
      result: { ok: true, missing: new Set(), linked: 0 },
    });
  });

  it("⚠️ counts DOCUMENTS, not rows, when one document appears twice", async () => {
    // The defect an adversarial round found: `linked` counted rows while
    // `missing` was a `Set`, so a report carrying one `docId` on two rows said
    // "1 of 3" over two visibly dead rows. Both halves are the distinct ids.
    let sent: unknown = null;
    const result = await withFetch(
      async (_url, init) => {
        sent = JSON.parse((init as { body: string }).body);
        return response({ existing: [] });
      },
      () =>
        auditSavedSession(
          session([
            entry({ path: "a", docId: A }),
            entry({ path: "b", docId: A }),
            entry({ path: "c", docId: B }),
          ]),
        ),
    );
    expect(result).toEqual({ ok: true, missing: new Set([A, B]), linked: 2 });
    expect(sent).toEqual({ ids: [A, B] });
  });

  it("⚠️ folds ids to the case Postgres answers in", async () => {
    // `document.id` is a Postgres `uuid`: it parses case-insensitively and
    // always renders LOWER-CASE. An adversarial round found an upper-case
    // `docId` in localStorage matching its row, coming back canonicalised, and
    // then failing the string comparison here — so a document sitting in the
    // archive was struck off as gone and the whole report declared stale.
    let sent: unknown = null;
    const result = await withFetch(
      async (_url, init) => {
        sent = JSON.parse((init as { body: string }).body);
        return response({ existing: [A] });
      },
      () => auditSavedSession(session([entry({ docId: A.toUpperCase() })])),
    );
    expect(sent).toEqual({ ids: [A] });
    expect(result).toEqual({ ok: true, missing: new Set(), linked: 1 });
  });

  it("sends every id in ONE request", async () => {
    let calls = 0;
    const many = Array.from({ length: 40 }, (_, i) =>
      entry({ path: `f${i}`, docId: `${i}`.padStart(8, "0") + "-2222-4333-8444-555555555555" }),
    );
    await withFetch(
      async () => {
        calls++;
        return response({ existing: [] });
      },
      () => auditSavedSession(session(many)),
    );
    expect(calls).toBe(1);
  });

  it("⚠️ reports a FAILURE, not a healthy report, when the route errors", async () => {
    const result = await withFetch(
      async () => response({ error: "boom" }, { ok: false }),
      () => auditSavedSession(session([entry({ docId: A })])),
    );
    expect(result).toEqual({ ok: false });
  });

  it("⚠️ reports a failure when the session has expired", async () => {
    // The expired-Supabase-session tell (CLAUDE.md): the middleware redirects to
    // /sign-in and fetch follows it into a cheerful 200 of HTML. Without this,
    // the day the sign-in page ever answers JSON, a signed-out user would be
    // told their saved report still matches an archive nobody asked.
    const result = await withFetch(
      async () => response({ existing: [A] }, { redirected: true }),
      () => auditSavedSession(session([entry({ docId: A })])),
    );
    expect(result).toEqual({ ok: false });
  });

  it("⚠️ reports a failure when the body is not the shape it claims", async () => {
    for (const body of [{}, { existing: null }, { existing: "none" }, "not json at all"]) {
      const result = await withFetch(
        async () => response(body),
        () => auditSavedSession(session([entry({ docId: A })])),
      );
      expect({ body, result }).toEqual({ body, result: { ok: false } });
    }
  });

  it("⚠️ reports a failure when the network throws, rather than propagating", async () => {
    // The caller is `void auditSavedSession(...).then(...)` with no rejection
    // handler, so a throw here is an unhandled rejection and the screen sits on
    // "se verifică…" for ever — the one state the three-state answer exists to
    // avoid claiming.
    const result = await withFetch(
      async () => {
        throw new Error("network down");
      },
      () => auditSavedSession(session([entry({ docId: A })])),
    );
    expect(result).toEqual({ ok: false });
  });

  it("⚠️ reports a failure on a saved report that is not the shape it claims", async () => {
    // `loadSavedSession` is a bare `JSON.parse` with a blind cast, so a report
    // written by an older build — or edited by hand — can arrive without an
    // `entries` array at all. An adversarial round found this throwing before
    // the `try` began. Same remedy as every other failure: say we could not
    // check, rather than saying nothing and leaving the screen mid-sentence.
    const malformed = { rootFolderName: "Arhiva", savedAt: "x" } as unknown as SavedImportSession;
    const result = await withFetch(
      async () => response({ existing: [] }),
      () => auditSavedSession(malformed),
    );
    expect(result).toEqual({ ok: false });
  });

  it("does not let a malformed id refuse the whole question", async () => {
    // The route drops what it cannot compare rather than refusing the body, so
    // this module sends what the report holds. A row whose id could never be a
    // `document.id` comes back absent, which is "gone" — and a link to it is
    // dead whatever the archive holds.
    let sent: unknown = null;
    const result = await withFetch(
      async (_url, init) => {
        sent = JSON.parse((init as { body: string }).body);
        return response({ existing: [A] });
      },
      () => auditSavedSession(session([entry({ path: "a", docId: A }), entry({ path: "b", docId: "not-a-uuid" })])),
    );
    expect(sent).toEqual({ ids: [A, "not-a-uuid"] });
    expect(result).toEqual({ ok: true, missing: new Set(["not-a-uuid"]), linked: 2 });
  });
});
